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
import {
    collectTestSamples,
    createAdHocSample,
    findExpectedOutput,
    previewTestSampleInput,
    TestSample,
    testSampleSourceLabel,
} from "../utils/testSamples";
import { DialogType, promptForOpenOutputChannel, showFileSelectDialog } from "../utils/uiUtils";
import { PtaSubmissionProvider } from "../webview/PtaSubmissionProvider";
import { PtaTestProvider } from "../webview/PtaTestProvider";
import { TestView } from "../webview/views/TestView";
import { l10n } from "vscode";
import { timerController } from "../timer/timerController";
import { timerManager } from "../timer/timerManager";

type TestPickKind = "all" | "choose" | "direct" | "file";

/** 用于丢弃过期批次的回调，避免连续点击“运行全部”时两次结果互相覆盖 */
let activeTestRun = 0;
/** 上一次批量测试的取消信号，新批次开始时会停止旧批次继续提交 */
let activeCancellation: { isCancellationRequested: boolean } | undefined;

export async function submitSolution(ptaCode: IPtaCode): Promise<void> {
    try {
        if (!ptaCode.code) {
            vscode.window.showWarningMessage(
                l10n.t("The code must be wrapped in `@pintia code=start` and `@pintia code=end`")
            );
            return;
        }

        // 在提交前捕获本次计时：评测期间继续答题或暂停都不应改变这次提交的耗时
        const acceptedSession = timerManager.getActiveSession(ptaCode.psID, ptaCode.pID);

        const solution: { compiler: string; code: string } = {
            compiler: ptaCode.compiler,
            code: ptaCode.code,
        };
        await ptaExecutor.submitSolution(
            ptaCode.psID,
            ptaCode.pID,
            solution,
            async (msg: string, data?: IProblemSubmissionResult) => {
                switch (msg) {
                    case "SUCCESS":
                        if (acceptedSession && data!.submission.status === "ACCEPTED") {
                            // 只有「提交时本题正在计时 + 完全通过」才记录并通知。
                            // 计时记录失败不应让用户以为代码提交失败。
                            try {
                                await timerController.handleAccepted(
                                    ptaCode.psID,
                                    ptaCode.pID,
                                    data!.submission.id,
                                    acceptedSession,
                                    data!.submission.submitAt
                                );
                            } catch (error: any) {
                                ptaChannel.error(error?.toString?.() ?? String(error));
                            }
                        }
                        PtaSubmissionProvider.createOrUpdate(data!)
                            .show()
                            .then(() => {
                                explorerController.refreshTreeData();
                            });
                        break;
                    default:
                        vscode.window.showInformationMessage(l10n.t("submission failed!"));
                }
            }
        );
    } catch (error: any) {
        ptaChannel.error(error);
        await promptForOpenOutputChannel(
            l10n.t(`Failed to submit your code. Please check the output channel for details.`),
            DialogType.error
        );
    }
}

export async function testSolution(ptaCode: IPtaCode): Promise<void> {
    try {
        if (!ptaCode.code) {
            vscode.window.showWarningMessage(
                l10n.t("The code must be wrapped in `@pintia code=start` and `@pintia code=end`")
            );
            return;
        }

        const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID);
        const samples = collectTestSamples(problem, ptaCode.customTests);

        const picks: Array<IQuickPickItem<TestPickKind>> = [];
        if (samples.length >= 1) {
            picks.push({
                label: l10n.t("{0} Run all test cases", "$(run-all)"),
                description: l10n.t("{0} cases", samples.length),
                detail: l10n.t("Run every default, custom, and problem test case at once"),
                value: "all",
            });
        }
        if (samples.length >= 1) {
            picks.push({
                label: l10n.t("{0} Test a sample...", "$(list-selection)"),
                description: l10n.t("{0} cases", samples.length),
                detail: l10n.t("Choose from the default, custom, and problem test cases"),
                value: "choose",
            });
        }
        picks.push(
            {
                label: l10n.t("{0} Write directly...", "$(pencil)"),
                description: "",
                detail: l10n.t("Write test cases in input box"),
                value: "direct",
            },
            {
                label: l10n.t("{0} Browse...", "$(file-text)"),
                description: "",
                detail: l10n.t("Test with the written cases in file"),
                value: "file",
            }
        );

        const choice: IQuickPickItem<TestPickKind> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        if (choice.value === "all") {
            await runTestCases(ptaCode, problem, samples);
            return;
        }

        if (choice.value === "choose") {
            const testPicks: Array<IQuickPickItem<TestSample>> = samples.map((sample) => ({
                label: sample.name || l10n.t("Sample {0}", sample.index + 1),
                description: testSampleSourceLabel(sample.source),
                detail: l10n.t("Input: {0}", previewTestSampleInput(sample.input)),
                value: sample,
            }));
            const picked = await vscode.window.showQuickPick(testPicks, {
                canPickMany: true,
                placeHolder: l10n.t("Select test cases"),
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (!picked || picked.length === 0) {
                return;
            }
            await runTestCases(
                ptaCode,
                problem,
                picked.map((item) => item.value)
            );
            return;
        }

        let sample: TestSample | undefined;
        if (choice.value === "direct") {
            const testString: string | undefined = await vscode.window.showInputBox({
                prompt: l10n.t("Enter the test cases."),
                validateInput: (s: string): string | undefined =>
                    s && s.trim() ? undefined : "Test case must not be empty.",
                placeHolder: `${l10n.t("Example")}: 1 2 3\\n4 5 6`,
                ignoreFocusOut: true,
            });
            if (testString) {
                const input = testString.replace(/\\n/g, "\n");
                sample = createAdHocSample("direct", input);
                sample.expected = findExpectedOutput(problem, input);
            }
        } else if (choice.value === "file") {
            const testFile: vscode.Uri[] | undefined = await showFileSelectDialog(ptaConfig.getWorkspaceFolder());
            if (testFile && testFile.length) {
                const input: string = await fs.readFile(testFile[0].fsPath, "utf-8");
                if (input) {
                    sample = createAdHocSample("file", input);
                    sample.expected = findExpectedOutput(problem, input);
                } else {
                    vscode.window.showErrorMessage(l10n.t("The selected test file must not be empty."));
                }
            }
        }

        if (!sample || !sample.input) {
            return;
        }
        await runTestCases(ptaCode, problem, [sample]);
    } catch (error: any) {
        ptaChannel.error(error);
        await promptForOpenOutputChannel(
            l10n.t("Testing sample failed. Please check the output channel for details."),
            DialogType.error
        );
    }
}

export async function testCustomSample(ptaCode: IPtaCode, index: number): Promise<void> {
    try {
        if (!ptaCode.customTests || ptaCode.customTests.length <= index) {
            throw new Error("No custom samples found. Please check the format of the test code blocks.");
        }
        const problem: IProblem = await ptaApi.getProblem(ptaCode.psID, ptaCode.pID);
        const input = ptaCode.customTests[index];
        const sample: TestSample = {
            id: `custom:${index}`,
            source: "custom",
            index,
            input,
            expected: findExpectedOutput(problem, input),
        };
        await runTestCases(ptaCode, problem, [sample]);
    } catch (error: any) {
        ptaChannel.error(error);
        await promptForOpenOutputChannel(
            l10n.t("Testing sample failed. Please check the output channel for details."),
            DialogType.error
        );
    }
}

/**
 * 运行一批测试样例：先展示全部 pending 卡片，再逐条刷新结果。
 *
 * `show(false)` 只更新 HTML，不会抢焦点；面板被用户关闭后也不会被强行重开。
 */
async function runTestCases(ptaCode: IPtaCode, problem: IProblem, samples: TestSample[]): Promise<void> {
    if (samples.length === 0) {
        return;
    }

    // 新批次开始前停止旧批次，避免两次“运行全部”同时往拼题A 提交
    activeCancellation && (activeCancellation.isCancellationRequested = true);
    const cancellation = { isCancellationRequested: false };
    activeCancellation = cancellation;
    const runId = ++activeTestRun;
    const view = new TestView(
        problem,
        ptaCode.compiler,
        samples.map((sample) => ({ sample, phase: "pending" as const }))
    );

    await PtaTestProvider.createOrUpdate(view).show();

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshChain: Promise<void> = Promise.resolve();

    const refresh = (focused: boolean = false): Promise<void> => {
        refreshChain = refreshChain
            .then(() => {
                if (runId === activeTestRun) {
                    return PtaTestProvider.createOrUpdate(view).show(focused);
                }
                return undefined;
            })
            .catch((error: any) => {
                ptaChannel.error(error?.toString?.() ?? String(error));
            });
        return refreshChain;
    };

    const scheduleRefresh = (): void => {
        if (refreshTimer || runId !== activeTestRun) {
            return;
        }
        refreshTimer = setTimeout(() => {
            refreshTimer = undefined;
            void refresh(false);
        }, 500);
    };

    try {
        const updates = await ptaExecutor.testSolutions(
            ptaCode.psID,
            ptaCode.pID,
            { compiler: ptaCode.compiler, code: ptaCode.code ?? "" },
            samples.map((sample) => sample.input),
            {
                cancellationToken: cancellation as unknown as vscode.CancellationToken,
                onCaseUpdate: (update) => {
                    if (runId !== activeTestRun) {
                        return;
                    }
                    const entry = view.cases[update.index];
                    if (!entry) {
                        return;
                    }
                    entry.phase = update.phase;
                    entry.result = update.result;
                    entry.error = update.error;
                    scheduleRefresh();
                },
            }
        );

        if (runId !== activeTestRun) {
            return;
        }

        // 防御性处理：理论上 testSolutions 会为每条返回更新
        updates.forEach((update) => {
            const entry = view.cases[update.index];
            if (!entry) {
                return;
            }
            entry.phase = update.phase;
            entry.result = update.result;
            entry.error = update.error;
        });
        for (const entry of view.cases) {
            if (entry.phase === "pending" || entry.phase === "running") {
                entry.phase = "error";
                entry.error = l10n.t("Testing sample failed. Please check the output channel for details.");
            }
        }
    } catch (error: any) {
        ptaChannel.error(error?.toString?.() ?? String(error));
        if (runId === activeTestRun) {
            for (const entry of view.cases) {
                if (entry.phase === "pending" || entry.phase === "running") {
                    entry.phase = "error";
                    entry.error = error?.message ?? String(error);
                }
            }
            await promptForOpenOutputChannel(
                l10n.t("Testing sample failed. Please check the output channel for details."),
                DialogType.error
            );
        }
    } finally {
        if (activeCancellation === cancellation) {
            activeCancellation = undefined;
        }
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = undefined;
        }
        await refresh(false);
    }
}
