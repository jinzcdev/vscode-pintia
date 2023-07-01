import { AuthStatus, IUserSession, IWechatAuth, IWechatUserInfo, IWechatUserState } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { PtaLoginMethod } from "../shared";
import { ptaApi } from "../utils/api";
import { promptForOpenOutputChannel, DialogType } from "../utils/uiUtils";
import { ptaLoginProvider } from "../webview/ptaLoginProvider";
import { IUserAuthProvider } from "./IUserAuthProvider";

class WeChatAuthProvider implements IUserAuthProvider {

    async signIn(): Promise<IUserSession | undefined> {
        return new Promise(async (resolve, reject) => {
            try {
                const auth: IWechatAuth = await ptaApi.getWechatAuth();
                await ptaLoginProvider.showQRCode(auth.url);
                let userSession: IUserSession | undefined;
                let logged: boolean = false, cnt: number = 0;
                let interval = setInterval(async () => {
                    const authState = await ptaApi.getWechatAuthState(auth.state);
                    if (authState.status === AuthStatus.SUCCESSFUL) {

                        const userState: IWechatUserState = await ptaApi.getWechatAuthUser(auth.state);
                        const userInfo: IWechatUserInfo = await ptaApi.getWechatUserInfo(auth.state, userState.id);

                        userSession = {
                            id: userInfo.user.id,
                            user: userInfo.user.nickname,
                            email: userInfo.user.email,
                            loginMethod: PtaLoginMethod.WeChat,
                            cookie: userInfo.cookie
                        };
                        logged = true;
                        ptaLoginProvider.dispose();
                    }
                    if (++cnt === 60) {
                        ptaLoginProvider.dispose();
                    }
                }, 2000);
                ptaLoginProvider.onDidDisposeCallBack(() => {
                    clearInterval(interval);
                    resolve(userSession);
                });
            } catch (error: any) {
                ptaChannel.append(error.toString());
                await promptForOpenOutputChannel("Failed to login PTA. Please open the output channel for details.", DialogType.error);
                resolve(undefined);
            }
        });
    }

    async signOut(cookie: string): Promise<void> {
        return await ptaApi.signOut(cookie);
    }
}

export const weChatAuthProvider = new WeChatAuthProvider();