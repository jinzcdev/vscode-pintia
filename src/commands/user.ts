import { IQuickPickItem, UserStatus } from "../shared";
import * as vscode from "vscode";
import { IUserSession } from "../entity/userLoginSession";
import { ptaApi } from "../utils/api";
import { ptaManager } from "../PtaManager";
import { ICheckIn } from "../entity/ICheckIn";

export async function showUserManager(): Promise<void> {
    const userSession: IUserSession | undefined = ptaManager.getUserSession();
    let picks: IQuickPickItem<string>[] = [];
    if (userSession) {
        picks.push(
            {
                label: "Home",
                detail: "Open user home in browser",
                value: "HOME"
            },
            {
                label: "Check In",
                detail: "Check in the education store of PTA",
                value: "CHECKIN"
            },
            {
                label: "Sign Out",
                detail: "Sign out your account",
                value: "SIGNOUT"
            });
    } else {
        picks.push(
            {
                label: "Sign In",
                detail: "Sign in your PTA account",
                value: "SIGNIN"
            },
            {
                label: "Register",
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
    const userSession: IUserSession | undefined = ptaManager.getUserSession();
    if (userSession) {
        const response: ICheckIn = await ptaApi.checkin(userSession.cookie);
        if (response.rewards) {
            vscode.window.showInformationMessage("Successfully, check in PTA.");
        } else {
            vscode.window.showInformationMessage(response.error.message);
        }
    }
}