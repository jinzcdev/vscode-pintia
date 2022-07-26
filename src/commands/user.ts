import * as vscode from "vscode";
import { ICheckIn } from "../entity/ICheckIn";
import { IUserSession } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { ptaManager } from "../PtaManager";
import { IQuickPickItem } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, openUrl, promptForOpenOutputChannel } from "../utils/uiUtils";


export async function showUserManager(): Promise<void> {
    const userSession: IUserSession | undefined = ptaManager.getUserSession();
    let picks: IQuickPickItem<string>[] = [];
    if (userSession) {
        picks.push(
            {
                label: "$(home) Home",
                detail: "Open the user's home in browser",
                value: "HOME"
            },
            {
                label: "$(log-in) Check In",
                detail: "Check in the education store of PTA",
                value: "CHECKIN"
            },
            {
                label: "$(log-out) Sign Out",
                detail: "Sign out your account",
                value: "SIGNOUT"
            });
    } else {
        picks.push(
            {
                label: "$(log-in) Sign In",
                detail: "Sign in your PTA account",
                value: "SIGNIN"
            },
            {
                label: "$(person-add) Register",
                detail: "Register a new account",
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
                vscode.window.showInformationMessage("Successfully, check in PTA.");
            } else {
                vscode.window.showInformationMessage(response.error.message);
            }
        }
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        promptForOpenOutputChannel("Failed to check in. Please open the output channel for details.", DialogType.error);
    }
}

export async function checkedInStatus(): Promise<boolean> {
    try {
        const userSession: IUserSession | undefined = ptaManager.getUserSession();
        if (userSession) {
            return await ptaApi.getCheckInStatus(userSession.cookie).then(e => e.exists);
        }
    } catch (error: any) {
        ptaChannel.appendLine(error.toString());
        promptForOpenOutputChannel("Failed to check in. Please open the output channel for details.", DialogType.error);
    }
    return false;
}

export async function openPintiaHome(): Promise<void> {
    openUrl("https://pintia.cn/problem-sets/dashboard");
}