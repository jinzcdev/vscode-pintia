import { EventEmitter } from "events";
import * as vscode from "vscode";
import { UserStatus } from "./shared";
import { ptaExecutor } from "./PtaExecutor";


class PtaManager extends EventEmitter {

    private currentUser: string | undefined;
    private userStatus: UserStatus;

    constructor() {
        super();
        this.currentUser = undefined;
        this.userStatus = UserStatus.SignedOut;
    }

    public async signIn(): Promise<void> {
        const picks: Array<vscode.QuickPickItem> = [];
        picks.push(
            {
                label: "QR Code",
                detail: "Use wechat QRCode to login"
            },
            {
                label: "PTA Account",
                detail: "Use Pintia account to login"
            }
        );

        const choice: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(picks);
        if (!choice) {
            return;
        }
        const userName: string | undefined = await new Promise((resolve: (res: string | undefined) => void, reject: (e: Error) => void) => {
            return resolve("jinzcdev");
        });

        if (userName) {
            vscode.window.showInformationMessage(`Successfully, ${choice.label}.`);
            this.currentUser = userName;
            this.userStatus = UserStatus.SignedIn;
            // if status changed, problems refresh
            this.emit("statusChanged");
        }

        return Promise.resolve();
    }

    public async singOut(): Promise<void> {
        console.log("Sign Out ... ");
        return Promise.resolve();
    }

    public async getLoginStatus(): Promise<void> {
        try {
            const result: string = await ptaExecutor.getUserInfo();
            this.currentUser = result;
            this.userStatus = UserStatus.SignedIn;
        } catch (error) {
            this.currentUser = undefined;
            this.userStatus = UserStatus.SignedOut;
        } finally {
            this.emit("statusChanged");
        }
    }

    public getUser(): string | undefined {
        return this.currentUser;
    }
}

export const ptaManager = new PtaManager();