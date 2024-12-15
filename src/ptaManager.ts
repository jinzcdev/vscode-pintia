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
import * as cache from "./commands/cache";
import { l10n } from "vscode";
import { t } from "@vscode/l10n";


class PtaManager extends EventEmitter {

    private userSession: IUserSession | undefined;
    private userStatus: UserStatus;

    constructor() {
        super();
        this.userSession = undefined;
        this.userStatus = UserStatus.SignedOut;
    }

    public async signIn(): Promise<void> {
        if (this.userStatus === UserStatus.SignedIn) {
            const choice: string | undefined = await vscode.window.showQuickPick(
                ["Yes", "No"],
                { placeHolder: l10n.t("You are already logged in. Do you want to log out of the current account?") },
            );
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
                value: PtaLoginMethod.WeChat
            },
            {
                label: l10n.t("{0} Pintia Cookie", "$(key)"),
                detail: l10n.t("Use Pintia cookie to login"),
                value: PtaLoginMethod.Cookie
            }
        );

        const choice: IQuickPickItem<PtaLoginMethod> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        const userAuthProvider = UserAuthProviderFactory.createUserAuthProvider(choice.value);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t("Sign in ..."),
            cancellable: false
        }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
            return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
                try {
                    const userSession = await userAuthProvider.signIn();

                    if (userSession) {
                        const userSessionPath: string = path.join(configPath, 'user.json');
                        await fs.createFile(userSessionPath);
                        await fs.writeJson(userSessionPath, userSession)
                            .catch(reason => {
                                ptaChannel.appendLine(reason);
                                reject(reason);
                            });
                        vscode.window.showInformationMessage(l10n.t("Successfully logged in as {0}", userSession.user));
                        this.userSession = userSession;
                        this.userStatus = UserStatus.SignedIn;

                        ptaChannel.appendLine(`Login successfully and save \`user.json\` to ${path}`);

                        this.emit("statusChanged");
                    }

                    resolve();
                }
                catch (error: any) {
                    ptaChannel.appendLine(error.toString());
                    await promptForOpenOutputChannel(`Failed to login PTA. Please open the output channel for details.`, DialogType.error);
                    reject(error);
                }
            });
        });
    }

    public async signOut(): Promise<void> {
        try {

            const userFilePath = path.join(configPath, "user.json");
            if (await fs.pathExists(userFilePath)) {
                const loginSession: IUserSession = await fs.readJSON(userFilePath);
                const userAuthProvider = UserAuthProviderFactory.createUserAuthProvider(loginSession.loginMethod as PtaLoginMethod);

                await Promise.all([userAuthProvider.signOut(loginSession.cookie), fs.remove(userFilePath), cache.clearCache()]);
                vscode.window.showInformationMessage(l10n.t("Successfully signed out."));
                ptaChannel.appendLine(`[INFO] Logout the current user successfully and remove user information from ${userFilePath}.`);
            } else {
                vscode.window.showInformationMessage(l10n.t("The user is not logged in."));
                return;
            }

            this.userSession = undefined;
            this.userStatus = UserStatus.SignedOut;
            this.emit("statusChanged");
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            promptForOpenOutputChannel(l10n.t("Signout failed. Please open the output channel for details."), DialogType.error)
        }
    }

    public async fetchLoginStatus(): Promise<void> {
        const filePath = path.join(configPath, "user.json");
        try {
            if (await fs.pathExists(filePath)) {
                ptaChannel.appendLine(`[INFO] Read the user session from the "${filePath}"`);
                const loginSession: IUserSession = await fs.readJSON(filePath);
                const user: IPtaUser | undefined = await ptaApi.getCurrentUser(loginSession.cookie);
                if (user) {
                    loginSession.user = user.nickname;
                    loginSession.email = user.email;

                    this.userSession = loginSession;
                    this.userStatus = UserStatus.SignedIn;

                    fs.writeJson(filePath, loginSession).catch(async reason => {
                        ptaChannel.appendLine(`[ERROR]: ${reason.toString()}`);
                        await promptForOpenOutputChannel(l10n.t("Update user profile failed. Please open the output channel for details."), DialogType.error);
                    });
                } else {
                    this.userSession = undefined;
                    this.userStatus = UserStatus.SignedOut;
                    vscode.window.showErrorMessage(l10n.t("Login session has expired! Please login again."));
                }
            }
        } catch (error) {
            this.userSession = undefined;
            this.userStatus = UserStatus.SignedOut;
        } finally {
            this.emit("statusChanged");
        }
    }

    public getUserSession(): IUserSession | undefined {
        return this.userSession;
    }

    public getStatus(): UserStatus {
        return this.userStatus;
    }
}

export const ptaManager = new PtaManager();