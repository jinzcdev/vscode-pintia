import { EventEmitter } from "events";
import * as vscode from "vscode";
import { configPath, IQuickPickItem, PtaLoginMethod, UserStatus } from "./shared";
import { ptaExecutor } from "./PtaExecutor";
import { IUserSession } from "./entity/userLoginSession";
import { ptaApi } from "./utils/api";
import * as fs from "fs-extra";
import * as path from "path";
import { IPtaUser } from "./entity/PtaUser";
import { ptaChannel } from "./ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";


class PtaManager extends EventEmitter {

    private userSession: IUserSession | undefined;
    private userStatus: UserStatus;

    constructor() {
        super();
        this.userSession = undefined;
        this.userStatus = UserStatus.SignedOut;
    }

    public async signIn(): Promise<void> {
        const picks: IQuickPickItem<PtaLoginMethod>[] = [];
        picks.push(
            {
                label: "$(device-camera) QR Code",
                detail: "Use WeChat QRCode to login",
                value: PtaLoginMethod.WeChat
            },
            {
                label: "$(account) PTA Account",
                detail: "Use Pintia account to login",
                value: PtaLoginMethod.PTA,
            }
        );

        const choice: IQuickPickItem<PtaLoginMethod> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Waiting for sign in...",
            cancellable: false
        }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
            return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
                try {
                    await ptaExecutor.signIn(choice.value, async (msg: string, data?: IUserSession) => {
                        switch (msg) {
                            case "SUCCESS":
                                fs.writeJson(path.join(configPath, 'user.json'), data)
                                    .catch(reason => {
                                        ptaChannel.appendLine(reason);
                                        reject(reason);
                                    });
                                vscode.window.showInformationMessage(`Successfully, ${choice.value}.`);
                                this.userSession = data;
                                this.userStatus = UserStatus.SignedIn;

                                ptaChannel.appendLine(`Login successfully and save \`user.json\` to ${path}`);

                                this.emit("statusChanged");
                                break;
                            case "TIMEOUT":
                                vscode.window.showErrorMessage("Login timed out!");
                                ptaChannel.appendLine("Login timed out!");
                                break;
                            default:
                        }
                        resolve();
                    });
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
            await ptaExecutor.signOut();
            vscode.window.showInformationMessage("Successfully signed out.");
            this.userSession = undefined;
            this.userStatus = UserStatus.SignedOut;
            this.emit("statusChanged");
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            promptForOpenOutputChannel("Signout failed. Please open the output channel for details.", DialogType.error)
        }
    }

    public async fetchLoginStatus(): Promise<void> {
        const filePath = path.join(configPath, "user.json");
        try {
            if (await fs.pathExists(filePath)) {
                ptaChannel.appendLine(`[INFO] Read the usersession from the "${filePath}"`);
                const loginSession: IUserSession = await fs.readJSON(filePath);
                const user: IPtaUser | undefined = await ptaApi.getCurrentUser(loginSession.cookie);
                if (user) {
                    this.userSession = loginSession;
                    this.userStatus = UserStatus.SignedIn;
                } else {
                    this.userSession = undefined;
                    this.userStatus = UserStatus.SignedOut;
                    vscode.window.showErrorMessage("Login session has expired! Please login again.");
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