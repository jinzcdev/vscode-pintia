
import { Disposable } from "vscode";
import { IProblemSubmission } from "./entity/IProblemSubmission";
import { IProblemSubmissionResult } from "./entity/IProblemSubmissionResult";
import { ptaApi } from "./utils/api";
import * as fs from "fs-extra";
import { cacheDirPath, CallBack, configPath, ProblemType, PtaLoginMethod } from "./shared";
import * as path from "path";
import { IUserSession, IWechatAuth, AuthStatus, IWechatUserState, IWechatUserInfo } from "./entity/userLoginSession";
import { ptaLoginProvider } from "./webview/ptaLoginProvider";
import { EventEmitter } from "events";
import { ptaManager } from "./PtaManager";
import { IProblemSubmissionDetail } from "./entity/problemSubmissionCode";
import * as vscode from "vscode";
import { ptaChannel } from "./ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";
import * as cache from "./commands/cache";


class PtaExecutor extends EventEmitter implements Disposable {

    public async submitSolution(psID: string, pID: string, solution: { compiler: string, code: string }, callback: CallBack<IProblemSubmissionResult>): Promise<void> {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            vscode.window.showInformationMessage("Login session has expired!");
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
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Testing the sample...",
            cancellable: false
        }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
            return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {

                try {
                    const userSession: IUserSession | undefined = ptaManager.getUserSession();
                    if (!userSession) {
                        vscode.window.showInformationMessage("Login session has expired!");
                        return;
                    }

                    // if (!langCompilerMapping.has(solution.compiler)) {
                    //     throw `[ERROR] The language ${solution.compiler} is not supported.`;
                    // }

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
                        if (++cnt == 60) {
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

    public async signIn(value: PtaLoginMethod, callback: CallBack<IUserSession>): Promise<void> {
        if (value === PtaLoginMethod.WeChat) {
            await this.wechatSignIn(callback);
        } else {
            vscode.window.showInformationMessage("Logging in with PTA account will be implemented in the future.");
            await this.accountSignIn(callback);
        }
    }

    public async signOut(): Promise<void> {
        const userFilePath = path.join(configPath, "user.json");
        if (await fs.pathExists(userFilePath)) {
            const loginSession: IUserSession = await fs.readJSON(userFilePath);
            await Promise.all([ptaApi.signOut(loginSession.cookie), fs.remove(userFilePath), cache.clearCache()]);
            vscode.window.showInformationMessage("Successfully signed out.");
            ptaChannel.appendLine(`[INFO] Logout the current user successfully and remove user information from ${userFilePath}.`);
        } else {
            vscode.window.showInformationMessage("The user is not logged in.");
        }
    }

    public async wechatSignIn(callback: CallBack<IUserSession>): Promise<void> {
        try {
            const auth: IWechatAuth = await ptaApi.getWechatAuth();
            await ptaLoginProvider.showQRCode(auth.url);
            let cnt = 0;
            let interval = setInterval(async () => {
                const authState = await ptaApi.getWechatAuthState(auth.state);
                if (authState.status === AuthStatus.SUCCESSFUL) {

                    const userState: IWechatUserState = await ptaApi.getWechatAuthUser(auth.state);
                    const userInfo: IWechatUserInfo = await ptaApi.getWechatUserInfo(auth.state, userState.id);

                    callback("SUCCESS", {
                        id: userInfo.user.id,
                        user: userInfo.user.nickname,
                        email: userInfo.user.email,
                        loginMethod: PtaLoginMethod.WeChat,
                        cookie: userInfo.cookie
                    });

                    ptaLoginProvider.dispose();
                    clearInterval(interval);
                }
                if (++cnt === 60) {
                    callback("TIMEOUT");
                    ptaLoginProvider.dispose();
                    clearInterval(interval);
                }
            }, 2000);
            ptaLoginProvider.onDidDisposeCallBack(() => {
                clearInterval(interval);
                callback("");
            });
        } catch (error: any) {
            ptaChannel.append(error.toString());
            await promptForOpenOutputChannel("Failed to login PTA. Please open the output channel for details.", DialogType.error);
        }
    }

    public async accountSignIn(callback: (msg: string, data?: IUserSession) => void): Promise<void> {
        return Promise.resolve();
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