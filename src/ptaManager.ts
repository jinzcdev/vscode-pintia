import { EventEmitter } from "events";
import * as vscode from "vscode";
import { configPath, IQuickPickItem, PtaLoginMethod, UserStatus } from "./shared";
import { IUserSession } from "./entity/userLoginSession";
import { ptaApi } from "./utils/api";
import * as fs from "fs-extra";
import * as path from "path";
import { IPtaUser } from "./entity/IPtaUser";
import { ptaChannel } from "./ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";
import { UserAuthProviderFactory } from "./auth/UserAuthProviderFactory";
import { getSession, setSession } from "./sessionStore";
import { l10n } from "vscode";

/**
 * 登录态与会话持有者。
 *
 * 会话本身存在 [[sessionStore]] 里（那里是唯一可被 `httpUtils`/`ptaApi` 读取的地方），
 * 本类只负责写它并广播状态变化。
 *
 * 刻意不 import `commands/*`：那会让本类与 `commands/cache`、`commands/user`
 * 互相依赖。需要联动的事情改为发事件，由组合根 `extension.ts` 接线：
 * - `signedOut` —— 登出时清缓存
 * - `sessionRestored` —— 启动时从磁盘恢复会话后自动签到（交互式登录不发这个事件）
 */
class PtaManager extends EventEmitter {
    private userStatus: UserStatus;

    constructor() {
        super();
        this.userStatus = UserStatus.SignedOut;
    }

    public async signIn(): Promise<void> {
        if (this.userStatus === UserStatus.SignedIn) {
            const choice: string | undefined = await vscode.window.showQuickPick(["Yes", "No"], {
                placeHolder: l10n.t("You are already logged in. Do you want to log out of the current account?"),
            });
            if (!choice || choice === "No") {
                return;
            }
            await this.signOut();
        }
        const picks: IQuickPickItem<PtaLoginMethod>[] = [];
        picks.push(
            {
                label: l10n.t("{0} QR Code", "$(device-camera)"),
                detail: l10n.t("Use WeChat QRCode to login"),
                value: PtaLoginMethod.WeChat,
            },
            {
                label: l10n.t("{0} Pintia Cookie", "$(key)"),
                detail: l10n.t("Use Pintia cookie to login"),
                value: PtaLoginMethod.Cookie,
            }
        );

        const choice: IQuickPickItem<PtaLoginMethod> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        const userAuthProvider = UserAuthProviderFactory.createUserAuthProvider(choice.value);

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: l10n.t("Waiting for signin..."),
                cancellable: false,
            },
            async () => {
                try {
                    const userSession = await userAuthProvider.signIn();

                    if (userSession) {
                        const userSessionPath: string = path.join(configPath, "user.json");
                        await fs.createFile(userSessionPath);
                        await fs.writeJson(userSessionPath, userSession).catch((reason) => {
                            ptaChannel.info(reason);
                            throw reason;
                        });
                        vscode.window.showInformationMessage(l10n.t("Successfully logged in as {0}", userSession.user));
                        setSession(userSession);
                        this.userStatus = UserStatus.SignedIn;
                        // 题集列表按账号区分，而缓存路径是全局的：不失效会在切换账号后
                        // 于 TTL 内看到上一个账号的题集
                        await ptaApi.invalidateProblemSetsCache();

                        ptaChannel.info(`Login successfully and save \`user.json\` to ${userSessionPath}`);

                        this.emit("statusChanged");
                    }
                } catch (error: any) {
                    ptaChannel.error(error.toString());
                    await promptForOpenOutputChannel(
                        `Failed to login PTA. Please check the output channel for details.`,
                        DialogType.error
                    );
                    throw error;
                }
            }
        );
    }

    public async signOut(): Promise<void> {
        try {
            const userFilePath = path.join(configPath, "user.json");
            if (await fs.pathExists(userFilePath)) {
                const loginSession: IUserSession = await fs.readJSON(userFilePath);
                const userAuthProvider = UserAuthProviderFactory.createUserAuthProvider(
                    loginSession.loginMethod as PtaLoginMethod
                );

                await Promise.all([userAuthProvider.signOut(loginSession.cookie), fs.remove(userFilePath)]);
                vscode.window.showInformationMessage(l10n.t("Successfully signed out."));
                ptaChannel.info(
                    `Logout the current user successfully and remove user information from ${userFilePath}.`
                );
            } else {
                vscode.window.showInformationMessage(l10n.t("The user is not logged in."));
                return;
            }

            // 先广播再清会话：监听方（extension.ts）要在登出瞬间开始清缓存
            this.emit("signedOut");
            setSession(undefined);
            this.userStatus = UserStatus.SignedOut;
            this.emit("statusChanged");
        } catch (error: any) {
            ptaChannel.error(error.toString());
            promptForOpenOutputChannel(
                l10n.t("Signout failed. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    public async fetchLoginStatus(): Promise<void> {
        const filePath = path.join(configPath, "user.json");
        try {
            if (await fs.pathExists(filePath)) {
                ptaChannel.info(`Read the user session from the "${filePath}"`);
                const loginSession: IUserSession = await fs.readJSON(filePath);
                const user: IPtaUser | undefined = await ptaApi.getCurrentUser(loginSession.cookie);
                if (user) {
                    loginSession.user = user.nickname;
                    loginSession.email = user.email;

                    setSession(loginSession);
                    this.userStatus = UserStatus.SignedIn;

                    fs.writeJson(filePath, loginSession).catch(async (reason) => {
                        ptaChannel.error(reason.toString());
                        await promptForOpenOutputChannel(
                            l10n.t("Update user profile failed. Please check the output channel for details."),
                            DialogType.error
                        );
                    });
                    // 只有「从磁盘恢复会话」才自动签到；交互式登录不发这个事件
                    this.emit("sessionRestored");
                } else {
                    setSession(undefined);
                    this.userStatus = UserStatus.SignedOut;
                    vscode.window.showErrorMessage(l10n.t("Login session has expired! Please login again."));
                }
            }
        } catch (error) {
            setSession(undefined);
            this.userStatus = UserStatus.SignedOut;
        } finally {
            this.emit("statusChanged");
        }
    }

    public getUserSession(): IUserSession | undefined {
        return getSession();
    }

    public getStatus(): UserStatus {
        return this.userStatus;
    }
}

export const ptaManager = new PtaManager();
