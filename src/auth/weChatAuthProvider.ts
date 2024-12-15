import { l10n } from "vscode";
import { AuthStatus, IUserSession, IWechatAuth, IWechatUserInfo, IWechatUserState } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { PtaLoginMethod } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaLoginProvider } from "../webview/PtaLoginProvider";
import { LoginView } from "../webview/views/LoginView";
import { IUserAuthProvider } from "./IUserAuthProvider";

class WeChatAuthProvider implements IUserAuthProvider {

    async signIn(): Promise<IUserSession | undefined> {
        return new Promise(async (resolve, reject) => {
            try {
                const auth: IWechatAuth = await ptaApi.getWechatAuth();
                const ptaLoginProvider = PtaLoginProvider.createOrUpdate(new LoginView(auth.url));
                await ptaLoginProvider.show();
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
                await promptForOpenOutputChannel(l10n.t("Failed to login PTA. Please open the output channel for details."), DialogType.error);
                resolve(undefined);
            }
        });
    }

    async signOut(cookie: string): Promise<void> {
        return await ptaApi.signOut(cookie);
    }
}

export const weChatAuthProvider = new WeChatAuthProvider();