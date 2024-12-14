// Copyright (c) jinzcdev. All rights reserved.
// Licensed under the MIT license.

import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { ptaConfig } from "../ptaConfig";
import { IQuickPickItem } from "../shared";
import { showDirectorySelectDialog } from "./uiUtils";

export async function selectWorkspaceFolder(): Promise<string> {
    let workspaceFolder: string = ptaConfig.getWorkspaceFolder();
    if (workspaceFolder.trim() === "") {
        workspaceFolder = await determinePintiaFolder();
        if (workspaceFolder === "") {
            return "";
        }
    }
    let needAsk: boolean = true;
    await fs.ensureDir(workspaceFolder);
    for (const folder of vscode.workspace.workspaceFolders || []) {
        if (isSubFolder(folder.uri.fsPath, workspaceFolder)) {
            needAsk = false;
        }
    }
    if (!needAsk) {
        return workspaceFolder;
    }

    const defaultChoice = ptaConfig.getPreviewProblemDefaultOpenedMethod() as OpenOptionEnum;

    if (defaultChoice != OpenOptionEnum.alwaysAsk) {
        return await handleOpenOption(defaultChoice, workspaceFolder);
    }

    const choice: string | undefined = await vscode.window.showQuickPick(
        [
            OpenOptionEnum.justOpenFile,
            OpenOptionEnum.openInCurrentWindow,
            OpenOptionEnum.openInNewWindow,
            OpenOptionEnum.addToWorkspace,
        ],
        { placeHolder: "The PTA workspace folder is not opened in VS Code, would you like to open it?" },
    );

    if (choice) {
        return await handleOpenOption(choice as OpenOptionEnum, workspaceFolder);
    }

    return "";
}

async function handleOpenOption(option: OpenOptionEnum, workspaceFolder: string): Promise<string> {
    switch (option) {
        case OpenOptionEnum.justOpenFile:
            return workspaceFolder;
        case OpenOptionEnum.openInCurrentWindow:
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolder), false);
            break;
        case OpenOptionEnum.openInNewWindow:
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolder), true);
            break;
        case OpenOptionEnum.addToWorkspace:
            vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri: vscode.Uri.file(workspaceFolder) });
            break;
        default:
            return "";
    }
    return workspaceFolder;
}



export async function getActiveFilePath(uri?: vscode.Uri): Promise<string | undefined> {
    let textEditor: vscode.TextEditor | undefined;
    if (uri) {
        textEditor = await vscode.window.showTextDocument(uri, { preview: false });
    } else {
        textEditor = vscode.window.activeTextEditor;
    }

    if (!textEditor) {
        return undefined;
    }
    if (textEditor.document.isDirty && !await textEditor.document.save()) {
        vscode.window.showWarningMessage("Please save the solution file first.");
        return undefined;
    }
    return textEditor.document.uri.fsPath;
}


function isSubFolder(from: string, to: string): boolean {
    const relative: string = path.relative(from, to);
    if (relative === "") {
        return true;
    }
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function determinePintiaFolder(): Promise<string> {
    let result: string;
    const picks: Array<IQuickPickItem<string>> = [];
    picks.push(
        {
            label: `Default location`,
            detail: `${path.join(os.homedir(), ".pintia", "codes")}`,
            value: `${path.join(os.homedir(), ".pintia", "codes")}`,
        },
        {
            label: "$(file-directory) Browse...",
            value: ":browse",
        },
    );
    const choice: IQuickPickItem<string> | undefined = await vscode.window.showQuickPick(
        picks,
        { placeHolder: "Select where you would like to save your Pintia files" },
    );
    if (!choice) {
        result = "";
    } else if (choice.value === ":browse") {
        const directory: vscode.Uri[] | undefined = await showDirectorySelectDialog(os.homedir());
        if (!directory || directory.length < 1) {
            result = "";
        } else {
            result = directory[0].fsPath;
        }
    } else {
        result = choice.value;
    }

    ptaConfig.update("workspaceFolder", result);

    return result;
}

export enum OpenOptionEnum {
    alwaysAsk = "Always ask",
    justOpenFile = "Just open the problem file",
    openInCurrentWindow = "Open in current window",
    openInNewWindow = "Open in new window",
    addToWorkspace = "Add to workspace",
}
