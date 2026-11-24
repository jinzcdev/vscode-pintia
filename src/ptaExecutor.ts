import * as fs from "fs-extra";
import * as vscode from "vscode";
import { Disposable, l10n } from "vscode";
import { IProblemSubmission } from "./entity/IProblemSubmission";
import { IProblemSubmissionResult } from "./entity/IProblemSubmissionResult";
import { IProblemSubmissionDetail } from "./entity/problemSubmissionCode";
import { IUserSession } from "./entity/userLoginSession";
import { ptaChannel } from "./ptaChannel";
import { ptaManager } from "./ptaManager";
import { cacheDirPath, CallBack, ProblemPermissionEnum, ProblemType } from "./shared";
import { ptaApi } from "./utils/api";
import { HttpRequestOptions, IHttpRetryPolicy } from "./utils/httpUtils";
import {
    PollingCancelledError,
    pollUntil,
    SUBMISSION_POLL_MAX_ATTEMPTS,
    TEST_POLL_MAX_ATTEMPTS,
} from "./utils/polling";

/** 评测是否已结束：排队已清空，且状态不再是等待评测或正在评测 */
function isJudgingFinished(data: IProblemSubmissionResult): boolean {
    return data.queued === -1 && data.submission.status !== "WAITING" && data.submission.status !== "JUDGING";
}

/** 批量测试默认并发上限：足够快，同时显著降低触发 429 的概率 */
const TEST_BATCH_CONCURRENCY = 2;
/** 两次提交启动之间的最小间隔 */
const TEST_BATCH_START_INTERVAL_MS = 900;
/** 批量测试的轮询间隔 */
const TEST_BATCH_POLL_INTERVAL_MS = 1000;

/** 批量测试的默认限流重试策略；普通提交/单条测试不受影响 */
const DEFAULT_TEST_RETRY: IHttpRetryPolicy = {
    retries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 15000,
    jitterMs: 250,
    retryStatusCodes: [429],
    respectRetryAfter: true,
};

export interface ITestCaseUpdate {
    index: number;
    phase: "running" | "done" | "error" | "cancelled";
    result?: IProblemSubmissionResult;
    error?: string;
}

export interface ITestBatchOptions {
    concurrency?: number;
    startIntervalMs?: number;
    pollIntervalMs?: number;
    maxPollAttempts?: number;
    httpOptions?: HttpRequestOptions;
    cancellationToken?: vscode.CancellationToken;
    onCaseUpdate?: (update: ITestCaseUpdate) => void | Promise<void>;
    /** 可注入的等待实现，避免测试真实等待 */
    sleep?: (ms: number) => Promise<void>;
}

interface ISubmissionContext {
    cookie: string;
    problemType: ProblemType;
    examId: string;
    problemSetProblemId: string;
}

/**
 * 提交启动限速器。
 *
 * 先同步预占下一个时间槽再 await，单个事件循环内并发调用也不会同时通过。
 */
class StartRateLimiter {
    private nextAllowedAt = 0;

    constructor(
        private readonly intervalMs: number,
        private readonly sleep: (ms: number) => Promise<void>
    ) {}

    public async wait(): Promise<void> {
        const now = Date.now();
        const at = Math.max(now, this.nextAllowedAt);
        this.nextAllowedAt = at + this.intervalMs;
        const delayMs = at - now;
        if (delayMs > 0) {
            await this.sleep(delayMs);
        }
    }
}

class PtaExecutor implements Disposable {
    public async submitSolution(
        psID: string,
        pID: string,
        solution: { compiler: string; code: string },
        callback: CallBack<IProblemSubmissionResult>
    ): Promise<void> {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            vscode.window.showInformationMessage(l10n.t("User is not logged in or the login session has expired!"));
            return;
        }
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: l10n.t("Submitting to PTA..."),
                cancellable: false,
            },
            async () => {
                const cookie = userSession.cookie;
                const context = await this.prepareSubmissionContext(psID, pID, cookie);
                const submission = await this.submitWithContext(context, solution);
                const data = await pollUntil(
                    () => ptaApi.getProblemSubmissionResult(submission.submissionId, cookie),
                    isJudgingFinished,
                    { maxAttempts: SUBMISSION_POLL_MAX_ATTEMPTS, timeoutMessage: "Submission timeout" }
                );
                await callback("SUCCESS", data);
            }
        );
    }

    public async testSolution(
        psID: string,
        pID: string,
        solution: { compiler: string; code: string; testInput: string },
        callback: CallBack<IProblemSubmissionResult>
    ): Promise<void> {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            vscode.window.showInformationMessage(l10n.t("User is not logged in or the login session has expired!"));
            return;
        }
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: l10n.t("Testing the sample..."),
                cancellable: false,
            },
            async () => {
                const cookie = userSession.cookie;
                const context = await this.prepareSubmissionContext(psID, pID, cookie);
                const submission = await this.submitWithContext(context, solution);
                const data = await pollUntil(
                    () => ptaApi.getProblemTestResult(submission.submissionId, cookie),
                    isJudgingFinished,
                    { maxAttempts: TEST_POLL_MAX_ATTEMPTS, timeoutMessage: "Submission timeout" }
                );
                await callback("SUCCESS", data);
            }
        );
    }

    /**
     * 批量测试：exam 上下文只准备一次，随后用受限并发逐条提交并轮询。
     *
     * 底层接口不支持批量，这里通过固定 worker 池 + 提交启动间隔避免触发 429；
     * 单条失败只标记该条，不会中断整批。
     */
    public async testSolutions(
        psID: string,
        pID: string,
        solution: { compiler: string; code: string },
        testInputs: readonly string[],
        options: ITestBatchOptions = {}
    ): Promise<ITestCaseUpdate[]> {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            vscode.window.showInformationMessage(l10n.t("User is not logged in or the login session has expired!"));
            return [];
        }

        const total = testInputs.length;
        if (total === 0) {
            return [];
        }

        const cookie = userSession.cookie;
        const concurrency = Math.max(1, Math.min(options.concurrency ?? TEST_BATCH_CONCURRENCY, total));
        const startIntervalMs = options.startIntervalMs ?? TEST_BATCH_START_INTERVAL_MS;
        const pollIntervalMs = options.pollIntervalMs ?? TEST_BATCH_POLL_INTERVAL_MS;
        const maxAttempts = options.maxPollAttempts ?? TEST_POLL_MAX_ATTEMPTS;
        const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
        const httpOptions = options.httpOptions ?? { retry: DEFAULT_TEST_RETRY };
        const updates: ITestCaseUpdate[] = testInputs.map((_, index) => ({ index, phase: "cancelled" }));

        const emit = async (update: ITestCaseUpdate): Promise<void> => {
            try {
                await options.onCaseUpdate?.(update);
            } catch (error: any) {
                ptaChannel.error(error?.toString?.() ?? String(error));
            }
        };

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: total === 1 ? l10n.t("Testing the sample...") : l10n.t("Testing {0} test cases...", total),
                cancellable: true,
            },
            async (progress, token) => {
                const cancelled = (): boolean =>
                    token.isCancellationRequested || options.cancellationToken?.isCancellationRequested === true;

                const context = await this.prepareSubmissionContext(psID, pID, cookie, httpOptions);
                const limiter = new StartRateLimiter(startIntervalMs, sleep);
                let cursor = 0;
                let completed = 0;

                const finishCancelled = async (index: number): Promise<void> => {
                    updates[index] = { index, phase: "cancelled" };
                    completed++;
                    progress.report({
                        increment: 100 / total,
                        message: l10n.t("{0}/{1} completed", completed, total),
                    });
                    await emit(updates[index]);
                };

                const worker = async (): Promise<void> => {
                    while (true) {
                        const index = cursor++;
                        if (index >= total) {
                            return;
                        }
                        if (cancelled()) {
                            await finishCancelled(index);
                            continue;
                        }

                        await limiter.wait();
                        if (cancelled()) {
                            await finishCancelled(index);
                            continue;
                        }

                        await emit({ index, phase: "running" });
                        try {
                            const submission = await this.submitWithContext(
                                context,
                                { ...solution, testInput: testInputs[index] },
                                httpOptions
                            );
                            const data = await pollUntil(
                                () => ptaApi.getProblemTestResult(submission.submissionId, context.cookie, httpOptions),
                                isJudgingFinished,
                                {
                                    maxAttempts,
                                    intervalMs: pollIntervalMs,
                                    sleep,
                                    shouldCancel: cancelled,
                                    timeoutMessage: "Submission timeout",
                                }
                            );
                            updates[index] = { index, phase: "done", result: data };
                        } catch (error: any) {
                            if (error instanceof PollingCancelledError || cancelled()) {
                                updates[index] = { index, phase: "cancelled" };
                            } else {
                                updates[index] = {
                                    index,
                                    phase: "error",
                                    error: error?.message ?? String(error),
                                };
                            }
                        } finally {
                            completed++;
                            progress.report({
                                increment: 100 / total,
                                message: l10n.t("{0}/{1} completed", completed, total),
                            });
                            await emit(updates[index]);
                        }
                    }
                };

                await Promise.all(Array.from({ length: concurrency }, () => worker()));
            }
        );

        return updates;
    }

    /**
     * 提交与自定义测试共用的前置流程：题型判定 → 权限 → 确保 exam 存在。
     * 批量测试只调用一次。
     */
    private async prepareSubmissionContext(
        psID: string,
        pID: string,
        cookie: string,
        httpOptions?: HttpRequestOptions
    ): Promise<ISubmissionContext> {
        const problemType: ProblemType = (await ptaApi
            .getProblem(psID, pID, undefined, httpOptions)
            .then((e) => e.type)) as ProblemType;

        const problemPermission = (await ptaApi.getProblemSetPermission(
            psID,
            cookie,
            httpOptions
        )) as ProblemPermissionEnum;

        const problemSetExam = await ptaApi.getProblemSetExams(psID, cookie, httpOptions);
        if (!problemSetExam.exam) {
            // 用户个人的题集, 不自动创建 exam
            if (problemPermission === ProblemPermissionEnum.MY_PROBLEM_SET) {
                throw new Error("My problem set does not have exam.");
            }
            problemSetExam.exam = await ptaApi.createProblemSetExamAndReturn(psID, cookie, httpOptions);
        }

        return {
            cookie,
            problemType,
            examId: problemSetExam.exam.id,
            problemSetProblemId: pID,
        };
    }

    /**
     * 提交与自定义测试共用的 POST 流程。
     *
     * 传入 `testInput` 即自定义样例测试（会带上 customTestData）。
     */
    private async submitWithContext(
        context: ISubmissionContext,
        solution: { compiler: string; code: string; testInput?: string },
        httpOptions?: HttpRequestOptions
    ): Promise<IProblemSubmission> {
        const detail: IProblemSubmissionDetail = {
            problemId: "0",
            problemSetProblemId: context.problemSetProblemId,
        };
        if (solution.testInput !== undefined) {
            detail.customTestData = {
                hasCustomTestData: true,
                content: solution.testInput.endsWith("\n") ? solution.testInput : solution.testInput + "\n",
            };
        }
        detail[
            context.problemType === ProblemType.PROGRAMMING
                ? "programmingSubmissionDetail"
                : "codeCompletionSubmissionDetail"
        ] = {
            compiler: solution.compiler,
            program: solution.code,
        };

        const submission: IProblemSubmission = await ptaApi.submitSolution(
            context.examId,
            context.cookie,
            {
                details: [detail],
                problemType: context.problemType,
            },
            httpOptions
        );
        if (submission.error) {
            throw new Error(JSON.stringify(submission.error));
        }
        return submission;
    }

    public async clearCache(): Promise<void> {
        if (await fs.pathExists(cacheDirPath)) {
            await fs.remove(cacheDirPath);
            ptaChannel.info(`Clear the cache from the "${cacheDirPath}"`);
        }
    }

    public dispose() {}
}

export const ptaExecutor = new PtaExecutor();
