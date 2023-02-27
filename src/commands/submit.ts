
import * as fs from "fs-extra";
import * as vscode from "vscode";

import { IProblem } from "../entity/IProblem";
import { IProblemSubmissionResult } from "../entity/IProblemSubmissionResult";
import { explorerController } from "../explorer/explorerController";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { ptaExecutor } from "../PtaExecutor";
import { IPtaCode, IQuickPickItem } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel, showFileSelectDialog } from "../utils/uiUtils";
import { ptaSubmissionProvider } from "../webview/ptaSubmissionProvider";
import { ptaTestProvider } from "../webview/ptaTestProvider";

export async function submitSolution(ptaCode: IPtaCode): Promise<void> {
    try {
        if (!ptaCode.code) {
            vscode.window.showInformationMessage("The code must be wrapped in `@pintia code=start` and `@pintia code=end`");
            return;
        }

        const solution: { compiler: string, code: string } = {
            compiler: ptaCode.compiler,
            code: ptaCode.code
        };
        await ptaExecutor.submitSolution(ptaCode.psID, ptaCode.pID, solution, (msg: string, data?: IProblemSubmissionResult) => {
            switch (msg) {
                case "SUCCESS":
                    ptaSubmissionProvider.showSubmission(data!);
                    explorerController.refreshTreeData();
                    break;
                default:
                    vscode.window.showInformationMessage("submission failed!");
            }
        });
    } catch (error) {
        await promptForOpenOutputChannel(`Failed to submit the solution. Please open the output channel for details.`, DialogType.error);
    }
}

export async function testSolution(ptaCode: IPtaCode): Promise<void> {
    try {

        if (!ptaCode.code) {
            vscode.window.showWarningMessage("The code must be wrapped in `@pintia code=start` and `@pintia code=end`");
            return;
        }

        const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID);
        const exampleTestDatas = (problem.problemConfig.programmingProblemConfig ?? problem.problemConfig.codeCompletionProblemConfig)?.exampleTestDatas;

        const picks: Array<IQuickPickItem<string>> = [];
        if (ptaCode.customTests && ptaCode.customTests.length !== 0) {
            picks.push({
                label: "$(note) Custom test cases",
                description: "",
                detail: "Test with the custom cases",
                value: ":custom",
            });
        }
        picks.push(
            {
                label: "$(three-bars) Default test cases",
                description: (exampleTestDatas?.length ?? 0) / 2 === 0 ? "No default test cases provided" : "",
                detail: "Test with the default cases",
                value: ":default",
            },
            {
                label: "$(pencil) Write directly...",
                description: "",
                detail: "Write test cases in input box",
                value: ":direct",
            },
            {
                label: "$(file-text) Browse...",
                description: "",
                detail: "Test with the written cases in file",
                value: ":file",
            },
        );
        const choice: IQuickPickItem<string> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        let caseID: number = -1;
        let testInput: string = "", testOutput: string = "";

        if (choice.value === ":default") {
            let testPicks: IQuickPickItem<number>[] = [];

            if (exampleTestDatas) {
                for (let i = 0; i < exampleTestDatas.length / 2; i++) {
                    testPicks.push({
                        label: `Sample ${i + 1}`,
                        detail: exampleTestDatas[i].input,
                        value: i
                    });
                }
                const testChoice: IQuickPickItem<number> | undefined = await vscode.window.showQuickPick(testPicks);
                if (!testChoice) {
                    return;
                }
                caseID = testChoice.value;
                testInput = exampleTestDatas![caseID].input;
                testOutput = exampleTestDatas![caseID].output;
            } else {
                vscode.window.showErrorMessage("There is no default test sample for this problem.");
                return;
            }
        } else if (choice.value === ":direct") {
            const testString: string | undefined = await vscode.window.showInputBox({
                prompt: "Enter the test cases.",
                validateInput: (s: string): string | undefined => s && s.trim() ? undefined : "Test case must not be empty.",
                placeHolder: "Example: 1 2 3\\n4 5 6",
                ignoreFocusOut: true,
            });
            if (testString) {
                testInput = testString;
            }
        } else if (choice.value === ":file") {
            const testFile: vscode.Uri[] | undefined = await showFileSelectDialog(ptaConfig.getWorkspaceFolder());
            if (testFile && testFile.length) {
                const input: string = (await fs.readFile(testFile[0].fsPath, "utf-8"));
                if (input) {
                    testInput = input;
                } else {
                    vscode.window.showErrorMessage("The selected test file must not be empty.");
                }
            }
        } else if (choice.value === ":custom") {
            let testPicks: IQuickPickItem<number>[] = [];
            const customTests = ptaCode.customTests;
            if (customTests && customTests.length !== 0) {
                for (let i = 0; i < customTests.length; i++) {
                    testPicks.push({
                        label: `Sample ${i + 1}`,
                        detail: customTests[i],
                        value: i
                    });
                }
                const testChoice: IQuickPickItem<number> | undefined = await vscode.window.showQuickPick(testPicks);
                if (!testChoice) {
                    return;
                }
                testInput = customTests[testChoice.value];
            } else {
                vscode.window.showErrorMessage("No custom test samples added.");
                return;
            }
        }
        if (!testInput) {
            return;
        }
        const solution: { compiler: string, code: string, testInput: string } = {
            compiler: ptaCode.compiler,
            code: ptaCode.code,
            testInput: testInput
        };
        await ptaExecutor.testSolution(ptaCode.psID, ptaCode.pID, solution, (msg: string, data?: IProblemSubmissionResult) => {
            switch (msg) {
                case "SUCCESS":
                    ptaTestProvider.showTestResult(data!, testOutput);
                    break;
                default:
            }
        });
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        await promptForOpenOutputChannel("Testing sample failed. Please open output channel for details.", DialogType.error);
    }
}

export async function testCustomSample(ptaCode: IPtaCode, index: number): Promise<void> {
    try {
        if (!ptaCode.customTests || ptaCode.customTests.length <= index) {
            throw "There are no custom samples provided.";
        }
        const solution: { compiler: string, code: string, testInput: string } = {
            compiler: ptaCode.compiler,
            code: ptaCode.code ?? "",
            testInput: ptaCode.customTests[index]
        };
        await ptaExecutor.testSolution(ptaCode.psID, ptaCode.pID, solution, (msg: string, data?: IProblemSubmissionResult) => {
            switch (msg) {
                case "SUCCESS":
                    ptaTestProvider.showTestResult(data!);
                    break;
                default:
            }
        });
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        await promptForOpenOutputChannel("Testing sample failed. Please open output channel for details.", DialogType.error);
    }
}