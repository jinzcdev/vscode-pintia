import { EventEmitter } from "events";
import * as vscode from "vscode";
import { configPath, IQuickPickItem, PtaLoginMethod, UserStatus } from "./shared";
import { ptaExecutor } from "./PtaExecutor";
import { IUserSession } from "./entity/userLoginSession";
import { ptaApi } from "./utils/api";
import * as fs from "fs-extra";
import * as path from "path";
import { IPtaUser } from "./entity/PtaUser";


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
                label: "QR Code",
                detail: "Use wechat QRCode to login",
                value: PtaLoginMethod.WeChat
            },
            {
                label: "PTA Account",
                detail: "Use Pintia account to login",
                value: PtaLoginMethod.PTA
            }
        );

        const choice: IQuickPickItem<PtaLoginMethod> | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }
        try {
            await ptaExecutor.signIn(choice.value, async (msg: string, data?: IUserSession) => {
                switch (msg) {
                    case "SUCCESS":
                        await fs.writeJson(path.join(configPath, 'user.json'), data);
                        vscode.window.showInformationMessage(`Successfully, ${choice.value}.`);
                        this.userSession = data;
                        this.userStatus = UserStatus.SignedIn;

                        this.emit("statusChanged");
                        break;
                    case "TIMEOUT":
                        vscode.window.showErrorMessage("Login timed out!");

                    default:
                }
            });
        }
        catch (error) {
            console.log(error);
        }
    }

    public async signOut(): Promise<void> {
        try {
            await ptaExecutor.signOut();
            vscode.window.showInformationMessage("Successfully signed out.");
            this.userSession = undefined;
            this.userStatus = UserStatus.SignedOut;
            this.emit("statusChanged");
        } catch (error) {
            // swallow the error when sign out.
            console.log(error);
        }
    }

    public async fetchLoginStatus(): Promise<void> {
        const filePath = path.join(configPath, "user.json");
        try {
            if (await fs.pathExists(filePath)) {
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