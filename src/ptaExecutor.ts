
import { EventEmitter } from "events";
import * as fs from "fs-extra";
import * as vscode from "vscode";
import { Disposable } from "vscode";
import { IProblemSubmission } from "./entity/IProblemSubmission";
import { IProblemSubmissionResult } from "./entity/IProblemSubmissionResult";
import { IProblemSubmissionDetail } from "./entity/problemSubmissionCode";
import { IUserSession } from "./entity/userLoginSession";
import { ptaChannel } from "./ptaChannel";
import { ptaManager } from "./ptaManager";
import { cacheDirPath, CallBack, ProblemType } from "./shared";
import { ptaApi } from "./utils/api";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";


class PtaExecutor extends EventEmitter implements Disposable {

    public async submitSolution(psID: string, pID: string, solution: { compiler: string, code: string }, callback: CallBack<IProblemSubmissionResult>): Promise<void> {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            vscode.window.showInformationMessage("User is not logged in or the login session has expired!");
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Submitting to PTA...",
            cancellable: false
        }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
            return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
                try {
                    const cookie = userSession.cookie;
                    const problemType: ProblemType = await ptaApi.getProblem(psID, pID).then(e => e.type) as ProblemType;

                    const detail: IProblemSubmissionDetail = {
                        problemId: "0",
                        problemSetProblemId: pID
                    };
                    detail[problemType === ProblemType.PROGRAMMING ? "programmingSubmissionDetail" : "codeCompletionSubmissionDetail"] = {
                        compiler: solution.compiler,
                        program: solution.code
                    };

                    const submission: IProblemSubmission = await ptaApi.getProblemSetExam(psID, cookie)
                        .then(exam => exam.id)
                        .then(id => ptaApi.submitSolution(id, cookie, {
                            details: [detail],
                            problemType: problemType
                        }));
                    if (submission.error) {
                        throw JSON.stringify(submission.error);
                    }
                    let data: IProblemSubmissionResult;
                    let interval = setInterval(async () => {
                        data = await ptaApi.getProblemSubmissionResult(submission.submissionId, cookie);
                        if (data.queued === -1 && data.submission.status !== "WAITING"
                            && data.submission.status !== "JUDGING") {
                            resolve();
                            clearInterval(interval);
                            callback("SUCCESS", data);
                        }
                    }, 1000);
                } catch (error: any) {
                    reject(error);
                    ptaChannel.appendLine(error.toString());
                    await promptForOpenOutputChannel("Submitting solution Failed. Please open output channel for details.", DialogType.error);
                }
            });
        });
    }

    public async testSolution(psID: string, pID: string, solution: { compiler: string, code: string, testInput: string }, callback: CallBack<IProblemSubmissionResult>): Promise<void> {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            vscode.window.showInformationMessage("User is not logged in or the login session has expired!");
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Testing the sample...",
            cancellable: false
        }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
            return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {

                try {
                    const cookie = userSession.cookie;
                    const detail: IProblemSubmissionDetail = {
                        problemId: "0",
                        problemSetProblemId: pID,
                        customTestData: {
                            hasCustomTestData: true,
                            content: solution.testInput
                        }
                    };

                    const problemType: ProblemType = await ptaApi.getProblem(psID, pID).then(e => e.type) as ProblemType;

                    detail[problemType === ProblemType.PROGRAMMING ? "programmingSubmissionDetail" : "codeCompletionSubmissionDetail"] = {
                        compiler: solution.compiler,
                        program: solution.code
                    };


                    const submission: IProblemSubmission = await ptaApi.getProblemSetExam(psID, cookie)
                        .then(exam => exam.id)
                        .then(id => ptaApi.submitSolution(id, cookie, {
                            details: [detail],
                            problemType: problemType
                        }));
                    if (submission.error) {
                        throw JSON.stringify(submission.error);
                    }
                    let data: IProblemSubmissionResult, cnt: number = 0;
                    let interval = setInterval(async () => {
                        data = await ptaApi.getProblemTestResult(submission.submissionId, cookie);
                        if (data.queued === -1 && data.submission.status !== "WAITING"
                            && data.submission.status !== "JUDGING") {
                            resolve();
                            clearInterval(interval);
                            callback("SUCCESS", data);
                        }
                        if (++cnt === 60) {
                            throw "[ERROR] Submission timeout";
                        }
                    }, 1000);
                } catch (error: any) {
                    ptaChannel.appendLine(error.toString());
                    await promptForOpenOutputChannel("Testing sample failed. Please open the output channel for details.", DialogType.error);
                    reject(error);
                }
            });
        });
    }

    public async clearCache(): Promise<void> {
        if (await fs.pathExists(cacheDirPath)) {
            await fs.remove(cacheDirPath);
            ptaChannel.appendLine(`[INFO] Clear the cache from the "${cacheDirPath}"`);
        }
    }

    public dispose() {
    }
}

export const ptaExecutor = new PtaExecutor();