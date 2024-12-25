
import * as fs from "fs-extra";
import * as vscode from "vscode";

import { IProblem } from "../entity/IProblem";
import { IProblemSubmissionResult } from "../entity/IProblemSubmissionResult";
import { explorerController } from "../explorer/explorerController";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { ptaExecutor } from "../ptaExecutor";
import { IPtaCode, IQuickPickItem } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel, showFileSelectDialog } from "../utils/uiUtils";
import { PtaSubmissionProvider } from "../webview/PtaSubmissionProvider";
import { PtaTestProvider } from "../webview/PtaTestProvider";
import { TestView } from "../webview/views/TestView";
import { l10n } from "vscode";

export async function submitSolution(ptaCode: IPtaCode): Promise<void> {
    try {
        if (!ptaCode.code) {
            vscode.window.showInformationMessage(l10n.t("The code must be wrapped in `@pintia code=start` and `@pintia code=end`"));
            return;
        }

        const solution: { compiler: string, code: string } = {
            compiler: ptaCode.compiler,
            code: ptaCode.code
        };
        await ptaExecutor.submitSolution(ptaCode.psID, ptaCode.pID, solution, (msg: string, data?: IProblemSubmissionResult) => {
            switch (msg) {
                case "SUCCESS":
                    PtaSubmissionProvider.createOrUpdate(data!).show().then(() => {
                        explorerController.refreshTreeData();
                    });
                    break;
                default:
                    vscode.window.showInformationMessage(l10n.t("submission failed!"));
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
                label: l10n.t("{0} Custom test cases", "$(note)"),
                description: "",
                detail: l10n.t("Test with the custom cases"),
                value: ":custom",
            });
        }
        // todo 增加从题目内容中检测出的测试样例
        const problemContent = problem.content;
        if (problemContent.indexOf("```in") !== -1) {
            picks.push({
                label: l10n.t("{0} Test cases in the problem", "$(book)"),
                description: "",
                detail: l10n.t("Test with the input cases in the problem"),
                value: ":problem",
            });
        }
        picks.push(
            {
                label: l10n.t("{0} Default test cases", "$(three-bars)"),
                description: (exampleTestDatas?.length ?? 0) / 2 === 0 ? l10n.t("No default test cases provided") : "",
                detail: l10n.t("Test with the default cases (usually includes official test answers)"),
                value: ":default",
            },
            {
                label: l10n.t("{0} Write directly...", "$(pencil)"),
                description: "",
                detail: l10n.t("Write test cases in input box"),
                value: ":direct",
            },
            {
                label: l10n.t("{0} Browse...", "$(file-text)"),
                description: "",
                detail: l10n.t("Test with the written cases in file"),
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
                        label: l10n.t("Sample {0}", i + 1),
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
                vscode.window.showErrorMessage(l10n.t("There is no default test sample for this problem."));
                return;
            }
        } else if (choice.value === ":direct") {
            // TODO: Support multiple test cases simultaneously
            const testString: string | undefined = await vscode.window.showInputBox({
                prompt: l10n.t("Enter the test cases."),
                validateInput: (s: string): string | undefined => s && s.trim() ? undefined : "Test case must not be empty.",
                placeHolder: `${l10n.t("Example")}: 1 2 3\\n4 5 6`,
                ignoreFocusOut: true,
            });
            if (testString) {
                testInput = testString.replace(/\\n/g, '\n');
            }
        } else if (choice.value === ":file") {
            const testFile: vscode.Uri[] | undefined = await showFileSelectDialog(ptaConfig.getWorkspaceFolder());
            if (testFile && testFile.length) {
                const input: string = (await fs.readFile(testFile[0].fsPath, "utf-8"));
                if (input) {
                    testInput = input;
                } else {
                    vscode.window.showErrorMessage(l10n.t("The selected test file must not be empty."));
                }
            }
        } else if (choice.value === ":custom") {
            let testPicks: IQuickPickItem<number>[] = [];
            const customTests = ptaCode.customTests;
            if (customTests && customTests.length !== 0) {
                for (let i = 0; i < customTests.length; i++) {
                    testPicks.push({
                        label: l10n.t("Sample {0}", i + 1),
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
                vscode.window.showErrorMessage(l10n.t("No custom test samples found. Please check the format of the test code blocks."));
                return;
            }
        } else if (choice.value === ":problem") {
            let testPicks: IQuickPickItem<number>[] = [];
            const codeBlockRegex = /```in([\s\S]*?)```/g;
            const matches = problemContent.matchAll(codeBlockRegex);
            const testCases: string[] = [];
            for (const match of matches) {
                const codeBlockContent = match[1].trim();
                testCases.push(codeBlockContent);
            }
            if (testCases.length === 0) {
                return;
            }
            for (let i = 0; i < testCases.length; i++) {
                testPicks.push({
                    label: l10n.t("Sample {0}", i + 1),
                    detail: testCases[i],
                    value: i
                });
            }
            const testChoice: IQuickPickItem<number> | undefined = await vscode.window.showQuickPick(testPicks);
            if (!testChoice) {
                return;
            }
            testInput = testCases[testChoice.value];
            testOutput = getTestInputAnswerFromExampleTestDatas(problem, testInput) ?? ""
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
                    data!.problem = problem;
                    PtaTestProvider.createOrUpdate(new TestView(data!, testOutput)).show();
                    break;
                default:
            }
        });
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        await promptForOpenOutputChannel(l10n.t("Testing sample failed. Please open output channel for details."), DialogType.error);
    }
}

export async function testCustomSample(ptaCode: IPtaCode, index: number): Promise<void> {
    try {
        if (!ptaCode.customTests || ptaCode.customTests.length <= index) {
            throw new Error("No custom samples found. Please check the format of the test code blocks.");
        }
        const solution: { compiler: string, code: string, testInput: string } = {
            compiler: ptaCode.compiler,
            code: ptaCode.code ?? "",
            testInput: ptaCode.customTests[index]
        };
        const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID);
        let testOutput = getTestInputAnswerFromExampleTestDatas(problem, solution.testInput) ?? ""
        await ptaExecutor.testSolution(ptaCode.psID, ptaCode.pID, solution, (msg: string, data?: IProblemSubmissionResult) => {
            if (msg === "SUCCESS") {
                data!.problem = problem;
                PtaTestProvider.createOrUpdate(new TestView(data!, testOutput)).show();
            }
        });
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        await promptForOpenOutputChannel(l10n.t("Testing sample failed. Please open output channel for details."), DialogType.error);
    }
}

/**
 * Get the answer of the test input from the example test data if the test input matches the example test input.
 */
function getTestInputAnswerFromExampleTestDatas(problem: IProblem, customTestInput: string = "") {
    // TODO 支持多种题型
    const exampleTestDatas = (problem.problemConfig.programmingProblemConfig ?? problem.problemConfig.codeCompletionProblemConfig)?.exampleTestDatas;
    if (exampleTestDatas) {
        for (let i = 0; i < exampleTestDatas.length / 2; i++) {
            const input = exampleTestDatas[i]?.input ?? "";
            if (input.trim() === customTestInput.trim()) {
                return exampleTestDatas[i].output;
            }
        }
    }
    return "";
}
