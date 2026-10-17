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
import { pollUntil, SUBMISSION_POLL_MAX_ATTEMPTS, TEST_POLL_MAX_ATTEMPTS } from "./utils/polling";

/** 评测是否已结束：排队已清空，且状态不再是等待评测或正在评测 */
function isJudgingFinished(data: IProblemSubmissionResult): boolean {
    return data.queued === -1 && data.submission.status !== "WAITING" && data.submission.status !== "JUDGING";
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
                const submission = await this.createSubmission(psID, pID, cookie, solution);
                const data = await pollUntil(
                    () => ptaApi.getProblemSubmissionResult(submission.submissionId, cookie),
                    isJudgingFinished,
                    { maxAttempts: SUBMISSION_POLL_MAX_ATTEMPTS, timeoutMessage: "Submission timeout" }
                );
                callback("SUCCESS", data);
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
                const submission = await this.createSubmission(psID, pID, cookie, solution);
                const data = await pollUntil(
                    () => ptaApi.getProblemTestResult(submission.submissionId, cookie),
                    isJudgingFinished,
                    { maxAttempts: TEST_POLL_MAX_ATTEMPTS, timeoutMessage: "Submission timeout" }
                );
                callback("SUCCESS", data);
            }
        );
    }

    /**
     * 提交与自定义测试共用的前置流程：题型判定 → 权限 → 确保 exam 存在 → POST。
     *
     * 传入 `testInput` 即自定义样例测试（会带上 customTestData）。
     */
    private async createSubmission(
        psID: string,
        pID: string,
        cookie: string,
        solution: { compiler: string; code: string; testInput?: string }
    ): Promise<IProblemSubmission> {
        const problemType: ProblemType = (await ptaApi.getProblem(psID, pID).then((e) => e.type)) as ProblemType;

        const detail: IProblemSubmissionDetail = {
            problemId: "0",
            problemSetProblemId: pID,
        };
        if (solution.testInput !== undefined) {
            detail.customTestData = {
                hasCustomTestData: true,
                content: solution.testInput.endsWith("\n") ? solution.testInput : solution.testInput + "\n",
            };
        }
        detail[
            problemType === ProblemType.PROGRAMMING ? "programmingSubmissionDetail" : "codeCompletionSubmissionDetail"
        ] = {
            compiler: solution.compiler,
            program: solution.code,
        };

        const problemPermission = (await ptaApi.getProblemSetPermission(psID, cookie)) as ProblemPermissionEnum;

        const problemSetExam = await ptaApi.getProblemSetExams(psID, cookie);
        if (!problemSetExam.exam) {
            // 用户个人的题集, 不自动创建 exam
            if (problemPermission === ProblemPermissionEnum.MY_PROBLEM_SET) {
                throw new Error("My problem set does not have exam.");
            }
            problemSetExam.exam = await ptaApi.createProblemSetExamAndReturn(psID, cookie);
        }

        const submission: IProblemSubmission = await ptaApi.submitSolution(problemSetExam.exam.id, cookie, {
            details: [detail],
            problemType: problemType,
        });
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
