import * as vscode from "vscode";
import { l10n } from "vscode";
import { AuthStatus, IUserSession, IWechatAuth, IWechatUserInfo, IWechatUserState } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { PtaLoginMethod } from "../shared";
import { ptaApi } from "../utils/api";
import { delay } from "../utils/polling";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaLoginProvider } from "../webview/PtaLoginProvider";
import { LoginView } from "../webview/views/LoginView";
import { IUserAuthProvider } from "./IUserAuthProvider";

/** 扫码状态轮询间隔 */
const WECHAT_POLL_INTERVAL_MS = 2000;
/** 扫码状态轮询次数上限（约 2 分钟，与二维码有效期相当） */
const WECHAT_POLL_MAX_ATTEMPTS = 60;

class WeChatAuthProvider implements IUserAuthProvider {
    async signIn(): Promise<IUserSession | undefined> {
        try {
            const auth: IWechatAuth = await ptaApi.getWechatAuth();
            const ptaLoginProvider = PtaLoginProvider.createOrUpdate(new LoginView(auth.url));
            await ptaLoginProvider.show();

            let userSession: IUserSession | undefined;
            let panelClosed = false;
            // 面板关闭即结束等待：扫码成功、用户主动取消、轮询超时都会走到这里
            const closed = new Promise<void>((resolve) => {
                ptaLoginProvider.onDidDisposeCallBack(() => {
                    panelClosed = true;
                    resolve();
                });
            });

            void this.pollUntilScanned(auth.state, () => panelClosed).then((session) => {
                userSession = session;
                // 用户已经关掉面板时不必再关一次
                if (!panelClosed) {
                    ptaLoginProvider.dispose();
                }
            });

            await closed;
            return userSession;
        } catch (error: any) {
            ptaChannel.error(error.toString());
            await promptForOpenOutputChannel(
                l10n.t("Failed to login PTA. Please check the output channel for details."),
                DialogType.error
            );
            return undefined;
        }
    }

    /**
     * 轮询扫码状态直到成功、超时或用户关闭面板。
     *
     * 刻意不用 `setInterval`：回调抛错时既不会结束等待、也走不到收尾逻辑，
     * 而计数只在成功分支之前递增——一旦抛错就永远到不了上限，
     * 表现为「正在登录」的提示永不消失。这里有界的顺序循环保证一定会返回。
     */
    private async pollUntilScanned(state: string, isCancelled: () => boolean): Promise<IUserSession | undefined> {
        for (let attempt = 0; attempt < WECHAT_POLL_MAX_ATTEMPTS; attempt++) {
            await delay(WECHAT_POLL_INTERVAL_MS);
            if (isCancelled()) {
                return undefined;
            }
            try {
                const authState = await ptaApi.getWechatAuthState(state);
                if (authState.status !== AuthStatus.SUCCESSFUL) {
                    continue;
                }
                return await this.createSessionFromWechatState(state);
            } catch (error: any) {
                // 单次失败不终止等待，交给次数上限兜底
                ptaChannel.error(error.toString());
            }
        }
        return undefined;
    }

    /**
     * 扫码成功后用 state 换取会话。
     *
     * 微信号未绑定拼题A 账号时 `/wechat/state/{state}/user` 会返回 `{}`，
     * 此时必须停下来并告知用户，不能拿着 `undefined` 去请求 `login_users/undefined`。
     */
    private async createSessionFromWechatState(state: string): Promise<IUserSession | undefined> {
        const userState: IWechatUserState = await ptaApi.getWechatAuthUser(state);
        if (!userState?.id) {
            vscode.window.showErrorMessage(
                l10n.t(
                    "This WeChat account is not bound to a Pintia account. Please bind it on the Pintia website first."
                )
            );
            return undefined;
        }

        const userInfo: IWechatUserInfo = await ptaApi.getWechatUserInfo(state, userState.id);
        if (!userInfo?.user || !userInfo.cookie) {
            throw new Error(`Unexpected response when exchanging the WeChat session for state ${state}.`);
        }
        return {
            id: userInfo.user.id,
            user: userInfo.user.nickname,
            email: userInfo.user.email,
            loginMethod: PtaLoginMethod.WeChat,
            cookie: userInfo.cookie,
        };
    }

    async signOut(cookie: string): Promise<void> {
        return await ptaApi.signOut(cookie);
    }
}

export const weChatAuthProvider = new WeChatAuthProvider();
