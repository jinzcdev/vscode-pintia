
import * as vscode from "vscode";
import * as fs from "fs-extra";

import { ptaSubmissionProvider } from "../webview/ptaSubmissionProvider";
import { IProblemSubmissionResult } from "../entity/ProblemSubmissionResult";
import { ptaExecutor } from "../PtaExecutor";
import { IQuickPickItem, ProblemType } from "../shared";
import { ptaManager } from "../PtaManager";
import { getActiveFilePath } from "../utils/workspaceUtils";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaTestProvider } from "../webview/ptaTestProvider";

export async function submitSolution(uri: vscode.Uri, testCode?: string): Promise<void> {
    if (!await ptaManager.getUserSession()) {
        console.log("Login has expired!")
        return;
    }

    const filePath: string | undefined = await getActiveFilePath(uri);
    if (!filePath) {
        console.log("submitting filePath is undefined!");
        return;
    }

    if (!await fs.pathExists(filePath)) {
        console.log("submitted file doesn't exist.");
        throw "submitted file doesn't exist."
    }
    const content: string = await fs.readFile(filePath, "utf-8");
    const matchResult: RegExpMatchArray | null = content.match(/@pintia psid=(.*) pid=(.*) type=(.*) compiler=(.*)/);
    if (!matchResult) {
        return undefined;
    }
    const psID: string = matchResult[1];
    const pID: string = matchResult[2];
    const problemType: ProblemType = matchResult[3] as ProblemType;
    const compiler: string = matchResult[4];

    let startLine: number = 0, endLine: number = 0, code: string = "", lines: string[] = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("@pintia code=start") != -1) startLine = i;
        if (lines[i].indexOf("@pintia code=end") != -1) endLine = i;
    }
    if (startLine >= endLine) {
        vscode.window.showInformationMessage("The format of Code is wrong.");
        return;
    }
    for (let i = startLine + 1; i < endLine; i++) {
        code += lines[i] + "\n";
    }

    const solution: { compiler: string; code: string; testCode?: string } = {
        compiler: compiler,
        code: code
    };
    if (testCode) {
        solution.testCode = testCode;
    }
    await ptaExecutor.submitSolution(psID, pID, problemType, solution, (msg: string, data?: IProblemSubmissionResult) => {
        switch (msg) {
            case "SUCCESS":
                vscode.window.showInformationMessage("submission success!");
                if (!testCode) ptaSubmissionProvider.showSubmission(data!);
                else ptaTestProvider.showTestResult(data!);
                break;
            default:
                vscode.window.showInformationMessage("submission failed!");

        }
    });
}

// export async function testSolution(uri: vscode.Uri, testCode: string): Promise<void> {
//     try {
//         const picks: Array<IQuickPickItem<string>> = [];
//         picks.push(
//             {
//                 label: "$(three-bars) Default test cases",
//                 description: "",
//                 detail: "Test with the default cases",
//                 value: ":default",
//             },
//             {
//                 label: "$(pencil) Write directly...",
//                 description: "",
//                 detail: "Write test cases in input box",
//                 value: ":direct",
//             },
//             {
//                 label: "$(file-text) Browse...",
//                 description: "",
//                 detail: "Test with the written cases in file",
//                 value: ":file",
//             },
//         );
//         const choice: IQuickPickItem<string> | undefined = await vscode.window.showQuickPick(picks);
//         if (!choice) {
//             return;
//         }

//         let result: string | undefined;
//         switch (choice.value) {
//             case ":default":
//                 await submitSolution(uri);
//                 break;
//             case ":direct":
//                 const testString: string | undefined = await vscode.window.showInputBox({
//                     prompt: "Enter the test cases.",
//                     validateInput: (s: string): string | undefined => s && s.trim() ? undefined : "Test case must not be empty.",
//                     placeHolder: "Example: [1,2,3]\\n4",
//                     ignoreFocusOut: true,
//                 });
//                 if (testString) {
//                     result = await leetCodeExecutor.testSolution(filePath, parseTestString(testString));
//                 }
//                 break;
//             case ":file":
//                 const testFile: vscode.Uri[] | undefined = await showFileSelectDialog(filePath);
//                 if (testFile && testFile.length) {
//                     const input: string = (await fse.readFile(testFile[0].fsPath, "utf-8")).trim();
//                     if (input) {
//                         result = await leetCodeExecutor.testSolution(filePath, parseTestString(input.replace(/\r?\n/g, "\\n")));
//                     } else {
//                         vscode.window.showErrorMessage("The selected test file must not be empty.");
//                     }
//                 }
//                 break;
//             default:
//                 break;
//         }
//     } catch (error) {
//         await promptForOpenOutputChannel("Failed to test the solution. Please open the output channel for details.", DialogType.error);
//     }
// }