
import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs-extra";
import { selectWorkspaceFolder } from "../utils/workspaceUtils";
import { commentFormatMapping, compilerLangMapping, configPath, IPtaCode, IQuickPickItem, langCompilerMapping, ProblemType, problemTypeInfoMapping, ptaCompiler, searchIndexPath, ZOJ_PROBLEM_SET_ID } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaConfig } from "../ptaConfig";
import { ptaApi } from "../utils/api";
import { IProblem } from "../entity/IProblem";
import { ptaManager } from "../ptaManager";
import { IUserSession } from "../entity/userLoginSession";
import { IProblemSearchItem } from "../entity/IProblemSearchItem";
import { PtaPreviewProvider } from "../webview/PtaPreviewProvider";
import { ProblemView } from "../webview/views/ProblemView";


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
        // const availableLangs: string[] = availableCompilers.map<string>((value, _) => { return compilerLangMapping.get(value) ?? "" });

        if (problemCompiler !== "NO_COMPILER" && defaultCompiler !== problemCompiler) {
            vscode.window.showInformationMessage(`Only ${compilerLangMapping.get(problemCompiler)} is allowed in this problem.`);
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
                { placeHolder: "The default language is not allowed to use. Please select another one." },
            );
            if (!choice) {
                return;
            }
            defaultCompiler = choice.value;
        }

        const ext: string = ptaCompiler[defaultCompiler as keyof typeof ptaCompiler].ext;
        let finalPath: string = path.join(workspaceFolder, `${ptaCode.title!}.${ext}`);
        if (ptaConfig.getAutoCreateProblemSetFolder() && ptaCode.psName) {
            finalPath = path.join(workspaceFolder, ptaCode.psName, `${ptaCode.title!}.${ext}`);
        }


        if (!await fs.pathExists(finalPath)) {
            await fs.createFile(finalPath);

            const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID, ptaManager.getUserSession()?.cookie);

            const content: string[] = [
                `@pintia psid=${ptaCode.psID} pid=${ptaCode.pID} compiler=${defaultCompiler}`,
                `ProblemSet: ${ptaCode.psName ?? "None"}`,
                `Title: ${ptaCode.title!}`,
                ptaApi.getProblemURL(ptaCode.psID, ptaCode.pID, problem.type),
            ];

            const format = commentFormatMapping.get(compilerLangMapping.get(defaultCompiler) ?? "") ?? commentFormatMapping.get("C++ (g++)")!;
            let comment: string[] = [];
            comment.push(format.start);
            for (const e of content) {
                comment.push(format.middle + e);
                comment.push(format.middle);
            }
            comment.push(format.end);

            const lastSubmissionDetail = (await ptaApi.getLastSubmissions(ptaCode.psID, ptaCode.pID, ptaManager.getUserSession()?.cookie ?? ""))?.submissionDetails[0];
            const lastSubmittedCompiler: string = (lastSubmissionDetail?.programmingSubmissionDetail ?? lastSubmissionDetail?.codeCompletionSubmissionDetail)?.compiler ?? problemCompiler;
            const lastProgram: string | undefined = (lastSubmissionDetail && defaultCompiler === lastSubmittedCompiler)
                ? (lastSubmissionDetail.programmingSubmissionDetail?.program ?? lastSubmissionDetail.codeCompletionSubmissionDetail?.program) : "";
            await fs.writeFile(finalPath, comment.join('\n') + `\n${format.single}@pintia code=start\n${lastProgram ?? ""}\n${format.single}@pintia code=end`);
        }
        await vscode.window.showTextDocument(vscode.Uri.file(finalPath), { preview: false, viewColumn: vscode.ViewColumn.Two });
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        await promptForOpenOutputChannel("Coding the problem failed. Please open the output channel for details.", DialogType.error);
    }
}

export async function searchProblem(): Promise<void> {
    const userSession: IUserSession | undefined = ptaManager.getUserSession();
    if (!userSession) {
        vscode.window.showInformationMessage("User is not logged in or the login session has expired!");
        return;
    }
    const items = await parseProblemsToPicks(fetchProblemIndex());
    const choice: IQuickPickItem<IProblemSearchItem> | undefined = await vscode.window.showQuickPick(
        items,
        {
            matchOnDetail: true,
            placeHolder: `Select one problem (total: ${items.length})`,
        },
    );
    if (!choice) {
        return;
    }
    PtaPreviewProvider.createOrUpdate(new ProblemView(choice.value.psID, choice.value.pID)).show();
}

async function fetchProblemIndex(): Promise<Array<IProblemSearchItem>> {
    const problems: Array<IProblemSearchItem> = [];
    try {
        const searchIndex = await fs.readJSON(searchIndexPath);
        ptaChannel.appendLine("[INFO] Fetched the problem search index from the local");

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
        ptaChannel.appendLine(e.toString());
        await promptForOpenOutputChannel("Failed to fetch the problem search index. Please open the output channel for details.", DialogType.error);
    }

    return problems;
}

async function parseProblemsToPicks(p: Promise<IProblemSearchItem[]>): Promise<Array<IQuickPickItem<IProblemSearchItem>>> {
    let cnt = 0;
    return new Promise(async (resolve: (res: Array<IQuickPickItem<IProblemSearchItem>>) => void): Promise<void> => {
        const picks: Array<IQuickPickItem<IProblemSearchItem>> = (await p).map((problem: IProblemSearchItem) => Object.assign({}, {
            label: `[${++cnt}] ${problem.label} ${problem.title}`,
            description: "",
            detail: `Score: ${problem.score}, Type: ${problemTypeInfoMapping.get(problem.type)?.name ?? "Unknown"}, PS: ${problem.psName}`,
            value: problem,
        }));
        resolve(picks);
    });
}