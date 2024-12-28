import * as vscode from "vscode";
import { ICheckIn } from "../entity/checkin";
import { IUserSession } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { ptaManager } from "../ptaManager";
import { IQuickPickItem } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, openUrl, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaConfig } from "../ptaConfig";
import { l10n } from "vscode";


export async function showUserManager(): Promise<void> {
    const userSession: IUserSession | undefined = ptaManager.getUserSession();
    let picks: IQuickPickItem<string>[] = [];
    if (userSession) {
        picks.push(
            {
                label: l10n.t("{0} Home", "$(home)"),
                detail: l10n.t("Open the user's home in browser"),
                value: "HOME"
            },
            {
                label: l10n.t("{0} Check In", "$(log-in)"),
                detail: l10n.t("Check in the education store of PTA"),
                value: "CHECKIN"
            },
            {
                label: l10n.t("{0} Sign Out", "$(log-out)"),
                detail: l10n.t("Sign out your account"),
                value: "SIGNOUT"
            });
    } else {
        picks.push(
            {
                label: l10n.t("{0} Sign In", "$(log-in)"),
                detail: l10n.t("Sign in your PTA account"),
                value: "SIGNIN"
            },
            {
                label: l10n.t("{0} Register", "$(person-add)"),
                detail: l10n.t("Register a new account"),
                value: "REGISTER"
            });
    }
    const choice: IQuickPickItem<string> | undefined = await vscode.window.showQuickPick(picks);
    if (!choice) {
        return;
    }
    switch (choice.value) {
        case "HOME": vscode.env.openExternal(vscode.Uri.parse('https://pintia.cn/home/account')); break;
        case "REGISTER": vscode.env.openExternal(vscode.Uri.parse('https://pintia.cn/auth/register')); break;
        case "CHECKIN": vscode.commands.executeCommand("pintia.checkIn"); break;
        case "SIGNIN": vscode.commands.executeCommand("pintia.signIn"); break;
        case "SIGNOUT": vscode.commands.executeCommand("pintia.signOut"); break;
    }
}

export async function checkInPTA(): Promise<void> {
    try {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (userSession) {
            const response: ICheckIn = await ptaApi.checkin(userSession.cookie);
            if (response.rewards) {
                vscode.window.showInformationMessage(l10n.t("Successfully, check in PTA."));
            } else {
                vscode.window.showInformationMessage(response.error.message);
            }
        }
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        promptForOpenOutputChannel(l10n.t("Failed to check in. Please open the output channel for details."), DialogType.error);
    }
}

export async function autoCheckInPTA(): Promise<void> {
    if (!ptaConfig.getAutoCheckIn()) {
        return;
    }
    checkedInStatus().then(checked => {
        if (!checked) {
            checkInPTA();
        }
    });
}

export async function checkedInStatus(): Promise<boolean> {
    try {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (userSession) {
            return await ptaApi.getCheckInStatus(userSession.cookie).then(e => e.exists);
        }
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        promptForOpenOutputChannel(l10n.t("Failed to get the status of checkin. Please open the output channel for details."), DialogType.error);
    }
    return false;
}

export async function openPintiaHome(): Promise<void> {
    openUrl("https://pintia.cn/problem-sets/dashboard");
}

export async function openExtensionRepo() {
    openUrl("https://github.com/jinzcdev/vscode-pintia");
}

export async function reportIssue(): Promise<void> {
    openUrl("https://github.com/jinzcdev/vscode-pintia/issues");
}
