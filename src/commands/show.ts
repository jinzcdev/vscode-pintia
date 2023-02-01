
import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs-extra";
import { selectWorkspaceFolder } from "../utils/workspaceUtils";
import { commentFormatMapping, compilerLangMapping, configPath, IPtaCode, IQuickPickItem, langCompilerMapping, ProblemType, problemTypeNameMapping, ptaCompiler } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaConfig } from "../ptaConfig";
import { ptaApi } from "../utils/api";
import { IProblem } from "../entity/IProblem";
import { ptaManager } from "../PtaManager";
import { IUserSession } from "../entity/userLoginSession";
import { IProblemSearchItem } from "../entity/IProblemSearchItem";
import { ptaPreviewProvider } from "../webview/ptaPreviewProvider";


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
                `https://pintia.cn/problem-sets/${ptaCode.psID}/exam/problems/${ptaCode.pID}`
            ];

            const format = commentFormatMapping.get(compilerLangMapping.get(defaultCompiler) ?? "") ?? commentFormatMapping.get("C++ (g++)")!;
            let comment: string[] = [];
            comment.push(format.start);
            for (const e of content) {
                comment.push(format.middle + e);
                comment.push(format.middle);
            }
            comment.push(format.end);
            const lastSubmittedCompiler: string = (problem.lastSubmissionDetail?.programmingSubmissionDetail ?? problem.lastSubmissionDetail?.codeCompletionSubmissionDetail)?.compiler ?? problemCompiler;
            const lastProgram: string | undefined = (problem.lastSubmissionId !== "0" && defaultCompiler === lastSubmittedCompiler)
                ? (problem.lastSubmissionDetail?.programmingSubmissionDetail ?? problem.lastSubmissionDetail?.codeCompletionSubmissionDetail)?.program : "";
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
        vscode.window.showInformationMessage("Login session has expired!");
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
    await ptaPreviewProvider.showPreview(choice.value.psID, choice.value.pID);
}

async function fetchProblemIndex(): Promise<Array<IProblemSearchItem>> {
    const problemSets = await fs.readJSON(path.join(configPath, "searchIndex.json"));
    const problems: Array<IProblemSearchItem> = [];
    const ignoreZOJ: boolean = ptaConfig.getSearchIndexIgnoreZOJ();
    for (const ps in problemSets) {
        if (ignoreZOJ && ps.trim() === "ZOJ Problem Set") {
            continue;
        }
        for (let problem of problemSets[ps]) {
            problem["psName"] = ps;
            problems.push(problem);
        }
    }
    return problems;
}

async function parseProblemsToPicks(p: Promise<IProblemSearchItem[]>): Promise<Array<IQuickPickItem<IProblemSearchItem>>> {
    let cnt = 0;
    return new Promise(async (resolve: (res: Array<IQuickPickItem<IProblemSearchItem>>) => void): Promise<void> => {
        const picks: Array<IQuickPickItem<IProblemSearchItem>> = (await p).map((problem: IProblemSearchItem) => Object.assign({}, {
            label: `[${++cnt}] ${problem.label} ${problem.title}`,
            description: "",
            detail: `Score: ${problem.score}, Type: ${problemTypeNameMapping.get(problem.type)}, PS: ${problem.psName}`,
            value: problem,
        }));
        resolve(picks);
    });
}