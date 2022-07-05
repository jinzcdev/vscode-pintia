
import { Disposable } from "vscode";
import { IProblemSubmission } from "./entity/ProblemSubmission";
import { IProblemSubmissionResult } from "./entity/ProblemSubmissionResult";
import { ptaApi } from "./utils/api";
import * as fs from "fs-extra";
import { configPath, PtaLoginMethod } from "./shared";
import * as path from "path";
import { ILoginSession, IWechatAuth, AuthStatus, IWechatUserState, IWechatUserInfo } from "./entity/userLoginSession";
import { ptaLoginProvider } from "./webview/ptaLoginProvider";
import { EventEmitter } from "events";


class PtaExecutor extends EventEmitter implements Disposable {

    public getUserInfo(): Promise<string> {
        return Promise.resolve("myuser");
    }

    public async submitSolution(psID: string, pID: string, filePath: string): Promise<boolean> {
        if (!await fs.pathExists(filePath)) {
            throw "submitted file doesn't exist."
        }
        const fileContent = await fs.readFile(filePath, "utf-8");

        const cookie = "PTASession=a3249ecf-9400-4b34-a57c-9adc840cb98d;";
        const compiler = "GXX";
        const submission: IProblemSubmission = await ptaApi.getProblemSetExam(psID, cookie)
            .then(exam => exam.id)
            .then(id => ptaApi.submitSolution(id, cookie, {
                details: [
                    {
                        problemId: pID,
                        problemSetProblemId: psID,
                        programmingSubmissionDetail: {
                            compiler: compiler,
                            program: fileContent
                        }
                    }
                ],
                problemType: "PROGRAMMING"
            }))

        let data: IProblemSubmissionResult;
        let interval = setInterval(async () => {
            data = await ptaApi.getProblemSubmissionResult(submission.submissionId, cookie);
            console.log(`Waiting for ${data.queued} users`);
            if (data.queued === -1) {
                clearInterval(interval)
                console.log(data)
            }
        }, 1000);
        return Promise.resolve(true);
    }

    public async signIn(value: PtaLoginMethod, callback: (msg: string, data?: ILoginSession) => void): Promise<void> {
        if (value === PtaLoginMethod.WeChat) {
            await this.wechatSignIn(callback);
        } else {
            await this.accountSignIn(callback);
        }
    }

    public async signOut(): Promise<void> {
        const filePath = path.join(configPath, "user.json");
        if (await fs.pathExists(filePath)) {
            const loginSession: ILoginSession = await fs.readJSON(filePath);
            Promise.all([ptaApi.signOut(loginSession.cookie), fs.remove(filePath)]);
        }
    }

    public async wechatSignIn(callback: (msg: string, data?: ILoginSession) => void): Promise<void> {
        const auth: IWechatAuth = await ptaApi.getWechatAuth();
        await ptaLoginProvider.showQRCode(auth.url);
        let cnt = 0;
        let interval = setInterval(async () => {
            const authState = await ptaApi.getWechatAuthState(auth.state);
            if (authState.status === AuthStatus.SUCCESSFUL) {
                console.log("wechat success");
                const userState: IWechatUserState = await ptaApi.getWechatAuthUser(auth.state);
                const userInfo: IWechatUserInfo = await ptaApi.getWechatUserInfo(auth.state, userState.id);
                console.log(userState, userInfo);

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
            if (++cnt === 20) {
                callback("TIMEOUT", undefined);
                ptaLoginProvider.dispose();
                clearInterval(interval);
            }
        }, 2000);
    }

    public async accountSignIn(callback: (msg: string, data?: ILoginSession) => void): Promise<void> {
        return Promise.resolve();
    }

    public dispose() {
        throw new Error("Method not implemented.");
    }
}

export const ptaExecutor = new PtaExecutor();