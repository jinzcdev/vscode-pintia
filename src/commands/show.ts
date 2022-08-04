
import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs-extra";
import { selectWorkspaceFolder } from "../utils/workspaceUtils";
import { commentFormatMapping, compilerLangMapping, IPtaCode, IQuickPickItem, langCompilerMapping, ptaCompiler } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaConfig } from "../ptaConfig";
import { ptaApi } from "../utils/api";
import { IProblem } from "../entity/IProblem";
import { ptaManager } from "../PtaManager";

/*
async function fetchProblemLanguage(): Promise<string | undefined> {
    const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("pintia");
    let defaultLanguage: string | undefined = leetCodeConfig.get<string>("defaultLanguage");
    if (defaultLanguage && languages.indexOf(defaultLanguage) < 0) {
        defaultLanguage = undefined;
    }
    const language: string | undefined = defaultLanguage || await vscode.window.showQuickPick(languages, { placeHolder: "Select the language you want to use", ignoreFocusOut: true });
    // fire-and-forget default language query
    (async (): Promise<void> => {
        if (language && !defaultLanguage && leetCodeConfig.get<boolean>("hint.setDefaultLanguage")) {
            const choice: vscode.MessageItem | undefined = await vscode.window.showInformationMessage(
                `Would you like to set '${language}' as your default language?`,
                DialogOptions.yes,
                DialogOptions.no,
                DialogOptions.never,
            );
            if (choice === DialogOptions.yes) {
                leetCodeConfig.update("defaultLanguage", language, true);
            } else if (choice === DialogOptions.never) {
                leetCodeConfig.update("hint.setDefaultLanguage", false, true);
            }
        }
    })();
    return language;
}
*/

export async function showCodingEditor(ptaCode: IPtaCode): Promise<void> {
    try {
        const workspaceFolder: string = await selectWorkspaceFolder();
        if (!workspaceFolder) {
            return;
        }

        const defaultLanguage: string = ptaConfig.getDefaultLanguage();
        let defaultCompiler: string = langCompilerMapping.get(defaultLanguage) ?? "GXX";

        const problemCompiler: string = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID).then(e => e.compiler);
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
        const finalPath: string = path.join(workspaceFolder, `${ptaCode.title!}.${ext}`);


        if (!await fs.pathExists(finalPath)) {
            await fs.createFile(finalPath);

            const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID, ptaManager.getUserSession()?.cookie);

            const content: string[] = [
                `@pintia psid=${ptaCode.psID} pid=${ptaCode.pID} compiler=${defaultCompiler}`,
                `ProblemSet: ${ptaCode.psName ?? "None"}`,
                `Title: ${ptaCode.title!}`,
                `https://pintia.cn/problem-sets/${ptaCode.psID}/problems/${ptaCode.pID}`
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
            await fs.writeFile(finalPath, comment.join('\n') + `\n\n${format.single}@pintia code=start\n\n${lastProgram ?? ""}\n\n${format.single}@pintia code=end`);
        }
        await vscode.window.showTextDocument(vscode.Uri.file(finalPath), { preview: false, viewColumn: vscode.ViewColumn.Two });
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        await promptForOpenOutputChannel("Coding the problem failed. Please open the output channel for details.", DialogType.error);
    }
}