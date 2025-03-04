import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs-extra";
import { selectWorkspaceFolder } from "../utils/workspaceUtils";
import { compilerLangMapping, IPtaCode, IQuickPickItem, langCompilerMapping, ProblemType, problemTypeInfoMapping, ptaCompiler, searchIndexPath, UNKNOWN, ZOJ_PROBLEM_SET_ID } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaConfig } from "../ptaConfig";
import { ptaApi } from "../utils/api";
import { IProblem } from "../entity/IProblem";
import { ptaManager } from "../ptaManager";
import { IUserSession } from "../entity/userLoginSession";
import { IProblemSearchItem } from "../entity/IProblemSearchItem";
import { l10n } from "vscode";
import { convertChineseCharacters } from "../utils/chineseUtils";


export async function showCodingEditor(ptaCode: IPtaCode): Promise<void> {
    try {
        const workspaceFolder: string = await selectWorkspaceFolder();
        if (!workspaceFolder) {
            return;
        }

        const defaultLanguage: string = ptaConfig.getDefaultLanguage();
        let defaultCompiler: string = langCompilerMapping.get(defaultLanguage) ?? "GXX";

        let problemCompiler: string = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID).then(e => e.compiler);
        if (ptaCode.problemType === ProblemType.MULTIPLE_FILE) {
            problemCompiler = "VERILOG";
        }
        const availableCompilers: string[] = await ptaApi.getProblemSetCompilers(ptaCode.psID);

        if (problemCompiler !== "NO_COMPILER" && defaultCompiler !== problemCompiler) {
            vscode.window.showInformationMessage(l10n.t("Only {0} is allowed in this problem.", compilerLangMapping.get(problemCompiler) ?? UNKNOWN));
            defaultCompiler = problemCompiler;
        } else if (availableCompilers.indexOf(defaultCompiler) === -1) {
            const picks: IQuickPickItem<string>[] = availableCompilers.map<IQuickPickItem<string>>((value, _) => {
                return {
                    label: compilerLangMapping.get(value) ?? "",
                    detail: "",
                    value: value,
                }
            });
            const choice: IQuickPickItem<string> | undefined = await vscode.window.showQuickPick(
                picks,
                { placeHolder: l10n.t("The default language is not allowed to use. Please select another one.") },
            );
            if (!choice) {
                return;
            }
            defaultCompiler = choice.value;
        }

        const ext: string = ptaCompiler[defaultCompiler as keyof typeof ptaCompiler].ext;

        const fileNameFormat = ptaConfig.getProblemFileName();

        let fileName = fileNameFormat.replace(/{label}/g, ptaCode.label ?? "")
            .replace(/{title}/g, ptaCode.title ?? "")
            .replace(/{pid}/g, ptaCode.pID)
            .replace(/{psid}/g, ptaCode.psID)
            .replace(/[<>:"/\\|?*]/g, '_').trim() ?? `${ptaCode.label} ${ptaCode.title}`;

        if (ptaConfig.getReplaceSpaceWithUnderscore()) {
            fileName = fileName.replace(/\s+/g, '_');
        }
        if (ptaConfig.getConvertChineseCharacters()) {
            fileName = convertChineseCharacters(fileName);
        }

        let finalPath: string = path.join(workspaceFolder, `${fileName}.${ext}`);
        if (ptaConfig.getAutoCreateProblemSetFolder() && ptaCode.psName) {
            // 如果题集名称包含中文且启用了转换中文字符
            const psName = ptaConfig.getConvertChineseCharacters() ? convertChineseCharacters(ptaCode.psName) : ptaCode.psName;
            finalPath = path.join(workspaceFolder, psName, `${fileName}.${ext}`);
        }

        const fileUri = vscode.Uri.file(finalPath);

        if (!await fs.pathExists(finalPath)) {
            await fs.ensureDir(path.dirname(finalPath));
            await fs.createFile(finalPath);

            const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID, ptaManager.getUserSession()?.cookie);

            const lastSubmissionDetail = (await ptaApi.getLastSubmissions(ptaCode.psID, ptaCode.pID, ptaManager.getUserSession()?.cookie ?? ""))?.submissionDetails[0];
            const lastSubmittedCompiler: string = (lastSubmissionDetail?.programmingSubmissionDetail ?? lastSubmissionDetail?.codeCompletionSubmissionDetail)?.compiler ?? problemCompiler;
            const lastProgram: string | undefined = (lastSubmissionDetail && defaultCompiler === lastSubmittedCompiler)
                ? (lastSubmissionDetail.programmingSubmissionDetail?.program ?? lastSubmissionDetail.codeCompletionSubmissionDetail?.program) : "";

            const content: string[] = [
                "$BLOCK_COMMENT_START",
                `  @pintia psid=${ptaCode.psID} pid=${ptaCode.pID} compiler=${defaultCompiler}`,
                `  ProblemSet: ${ptaCode.psName ?? "None"}`,
                `  Title: ${ptaCode.title!}`,
                `  ${ptaApi.getProblemURL(ptaCode.psID, ptaCode.pID, problem.type)}`,
                "$BLOCK_COMMENT_END",
                "$LINE_COMMENT @pintia code=start",
                `\${0}${lastProgram ?? ""}`,
                "$LINE_COMMENT @pintia code=end",
            ];
            const editor = await vscode.window.showTextDocument(fileUri, { preview: false, viewColumn: vscode.ViewColumn.Two });
            await editor.insertSnippet(new vscode.SnippetString(content.join("\n")));
            await vscode.workspace.save(fileUri);
        } else {
            await vscode.window.showTextDocument(fileUri, { preview: false, viewColumn: vscode.ViewColumn.Two });
        }
    } catch (error: any) {
        ptaChannel.error(error.toString());
        await promptForOpenOutputChannel(l10n.t("Coding the problem failed. Please open the output channel for details."), DialogType.error);
    }
}

export async function searchProblem(): Promise<void> {
    const userSession: IUserSession | undefined = ptaManager.getUserSession();
    if (!userSession) {
        vscode.window.showInformationMessage(l10n.t("User is not logged in or the login session has expired!"));
        return;
    }
    const items = await parseProblemsToPicks(fetchProblemIndex());
    const choice: IQuickPickItem<IProblemSearchItem> | undefined = await vscode.window.showQuickPick(
        items,
        {
            matchOnDetail: true,
            placeHolder: l10n.t("Select one problem (total: {0})", items.length),
        },
    );
    if (!choice) {
        return;
    }
    vscode.commands.executeCommand('pintia.previewProblem', choice.value.psID, choice.value.pID);
}

async function fetchProblemIndex(): Promise<Array<IProblemSearchItem>> {
    const problems: Array<IProblemSearchItem> = [];
    try {
        const searchIndex = await fs.readJSON(searchIndexPath);
        ptaChannel.info("Fetched the problem search index from the local");

        const ignoredLocked: boolean = ptaConfig.getSearchIndexIgnoreLockedProblemSets();
        const ignoredZOJ: boolean = ptaConfig.getSearchIndexIgnoreZOJ();

        const Unlocked: Map<string, boolean> = new Map();
        await ptaApi.getUnlockedProblemSetIDs(ptaManager.getUserSession()?.cookie!)
            .then(psIDs => psIDs.forEach(psID => Unlocked.set(psID, true)));

        for (const ps in searchIndex) {
            const [psID, psName] = ps.split("|");
            if ((ignoredZOJ && psID === ZOJ_PROBLEM_SET_ID)
                || (ignoredLocked && !Unlocked.get(psID))) {
                continue;
            }
            for (let problem of searchIndex[ps]) {
                problem["psName"] = psName;
                problem["psID"] = psID;
                problems.push(problem);
            }
        }
    } catch (e: any) {
        ptaChannel.error(e.toString());
        await promptForOpenOutputChannel(l10n.t("Failed to fetch the problem search index. Please open the output channel for details."), DialogType.error);
    }

    return problems;
}

async function parseProblemsToPicks(p: Promise<IProblemSearchItem[]>): Promise<Array<IQuickPickItem<IProblemSearchItem>>> {
    let cnt = 0;
    return new Promise(async (resolve: (res: Array<IQuickPickItem<IProblemSearchItem>>) => void): Promise<void> => {
        const picks: Array<IQuickPickItem<IProblemSearchItem>> = (await p).map((problem: IProblemSearchItem) => Object.assign({}, {
            label: `[${++cnt}] ${problem.label} ${problem.title}`,
            description: "",
            detail: `Score: ${problem.score}, Type: ${problemTypeInfoMapping.get(problem.type)?.name ?? UNKNOWN}, PS: ${problem.psName}`,
            value: problem,
        }));
        resolve(picks);
    });
}