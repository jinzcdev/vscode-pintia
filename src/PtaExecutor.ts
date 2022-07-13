
import { Disposable } from "vscode";
import { IProblemSubmission } from "./entity/ProblemSubmission";
import { IProblemSubmissionResult } from "./entity/ProblemSubmissionResult";
import { ptaApi } from "./utils/api";
import * as fs from "fs-extra";
import { CallBack, configPath, ProblemType, PtaLoginMethod } from "./shared";
import * as path from "path";
import { IUserSession, IWechatAuth, AuthStatus, IWechatUserState, IWechatUserInfo } from "./entity/userLoginSession";
import { ptaLoginProvider } from "./webview/ptaLoginProvider";
import { EventEmitter } from "events";
import { ptaManager } from "./PtaManager";


class PtaExecutor extends EventEmitter implements Disposable {

    public async submitSolution(psID: string, pID: string, problemType: ProblemType, solution: { compiler: string, code: string }, callback: CallBack<IProblemSubmissionResult>): Promise<void> {

        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (!userSession) {
            console.log("Login Session doesn't exist!");
            return;
        }
        const cookie = userSession.cookie;
        const compiler = solution.compiler;
        const submission: IProblemSubmission = await ptaApi.getProblemSetExam(psID, cookie)
            .then(exam => exam.id)
            .then(id => ptaApi.submitSolution(id, cookie, {
                details: [
                    problemType === ProblemType.PROGRAMMING ? {
                        problemId: "0",
                        problemSetProblemId: pID,
                        programmingSubmissionDetail: {
                            compiler: compiler,
                            program: solution.code
                        }
                    } : {
                        problemId: "0",
                        problemSetProblemId: pID,
                        codeCompletionSubmissionDetail: {
                            compiler: compiler,
                            program: solution.code
                        }
                    }
                ],
                problemType: problemType
            }))

        let data: IProblemSubmissionResult;
        let interval = setInterval(async () => {
            data = await ptaApi.getProblemSubmissionResult(submission.submissionId, cookie);
            console.log(`Waiting for ${data.queued} users`);
            if (data.queued === -1) {
                clearInterval(interval);
                callback("SUCCESS", data);
            }
        }, 1000);
    }

    public async signIn(value: PtaLoginMethod, callback: CallBack<IUserSession>): Promise<void> {
        if (value === PtaLoginMethod.WeChat) {
            await this.wechatSignIn(callback);
        } else {
            await this.accountSignIn(callback);
        }
    }

    public async signOut(): Promise<void> {
        const filePath = path.join(configPath, "user.json");
        if (await fs.pathExists(filePath)) {
            const loginSession: IUserSession = await fs.readJSON(filePath);
            Promise.all([ptaApi.signOut(loginSession.cookie), fs.remove(filePath)]);
        }
    }

    public async wechatSignIn(callback: CallBack<IUserSession>): Promise<void> {
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
                callback("TIMEOUT", undefined);
                ptaLoginProvider.dispose();
                clearInterval(interval);
            }
        }, 2000);
    }

    public async accountSignIn(callback: (msg: string, data?: IUserSession) => void): Promise<void> {
        return Promise.resolve();
    }

    public dispose() {
        throw new Error("Method not implemented.");
    }
}

export const ptaExecutor = new PtaExecutor();