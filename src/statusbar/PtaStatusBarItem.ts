import * as vscode from "vscode";
import { l10n } from "vscode";
import { IUserSession } from "../entity/userLoginSession";

export class PtaStatusBarItem implements vscode.Disposable {
    private readonly statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem();
        this.statusBarItem.command = "pintia.manageUser";
    }

    public updateStatusBar(userSession: IUserSession | undefined): void {
        if (userSession) {
            this.statusBarItem.text = `PTA: ${userSession.user}`;
        } else {
            this.statusBarItem.text = `PTA: ${l10n.t("Unknown")}`;
        }
    }

    public show(): void {
        this.statusBarItem.show();
    }

    public hide(): void {
        this.statusBarItem.hide();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
