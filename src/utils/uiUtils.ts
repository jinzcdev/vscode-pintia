
import * as vscode from "vscode";
import * as os from "os";
import { ptaChannel } from "../ptaChannel";

export namespace DialogOptions {
    export const open: vscode.MessageItem = { title: "Open" };
    export const yes: vscode.MessageItem = { title: "Yes" };
    export const no: vscode.MessageItem = { title: "No", isCloseAffordance: true };
    export const never: vscode.MessageItem = { title: "Never" };
    export const singUp: vscode.MessageItem = { title: "Sign up" };
}

export async function promptForOpenOutputChannel(message: string, type: DialogType): Promise<void> {
    let result: vscode.MessageItem | undefined;
    switch (type) {
        case DialogType.info:
            result = await vscode.window.showInformationMessage(message, DialogOptions.open, DialogOptions.no);
            break;
        case DialogType.warning:
            result = await vscode.window.showWarningMessage(message, DialogOptions.open, DialogOptions.no);
            break;
        case DialogType.error:
            result = await vscode.window.showErrorMessage(message, DialogOptions.open, DialogOptions.no);
            break;
        default:
            break;
    }

    if (result === DialogOptions.open) {
        ptaChannel.show();
    }
}

export async function openSettingsEditor(query?: string): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", query);
}

export async function openKeybindingsEditor(query?: string): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", query);
}

export async function showFileSelectDialog(fsPath?: string): Promise<vscode.Uri[] | undefined> {
    const defaultUri: vscode.Uri | undefined = getBelongingWorkspaceFolderUri(fsPath);
    const options: vscode.OpenDialogOptions = {
        defaultUri,
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Select",
    };
    return await vscode.window.showOpenDialog(options);
}

function getBelongingWorkspaceFolderUri(fsPath: string | undefined): vscode.Uri | undefined {
    let defaultUri: vscode.Uri | undefined;
    if (fsPath) {
        const workspaceFolder: vscode.WorkspaceFolder | undefined = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
        if (workspaceFolder) {
            defaultUri = workspaceFolder.uri;
        }
    }
    return defaultUri;
}

export async function showDirectorySelectDialog(fsPath?: string): Promise<vscode.Uri[] | undefined> {
    const defaultUri: vscode.Uri = getBelongingWorkspaceFolderUri(fsPath) ?? vscode.Uri.parse(os.homedir());
    const options: vscode.OpenDialogOptions = {
        defaultUri,
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select",
    };
    return await vscode.window.showOpenDialog(options);
}

export async function openUrl(url: string): Promise<void> {
    vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(url));
}

export async function showYesOrNoPick(message: string): Promise<boolean> {
    return await vscode.window.showInformationMessage(message, DialogOptions.yes, DialogOptions.no) === DialogOptions.yes;
}

export enum DialogType {
    info = "info",
    warning = "warning",
    error = "error",
}
