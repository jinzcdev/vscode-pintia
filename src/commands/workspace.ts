
import * as vscode from 'vscode';
import { showDirectorySelectDialog } from '../utils/uiUtils';
import { ptaConfig } from '../ptaConfig';
import * as fs from 'fs-extra';
import { determinePintiaFolder } from '../utils/workspaceUtils';

export async function changeWorkspaceFolder() {
    const directory: vscode.Uri[] | undefined = await showDirectorySelectDialog();
    if (!directory || directory.length < 1) {
        return;
    }
    ptaConfig.update("workspaceFolder", directory[0].path);
}

export async function openWorkspace() {
    let workspaceFolder: string = ptaConfig.getWorkspaceFolder().trim();
    if (workspaceFolder === "" || !await fs.pathExists(workspaceFolder)) {
        workspaceFolder = await determinePintiaFolder();
        if (workspaceFolder === "") {
            return;
        }
    }

    const choice: string | undefined = await vscode.window.showQuickPick(
        [
            OpenOption.openInCurrentWindow,
            OpenOption.openInNewWindow
        ],
        { placeHolder: "How would you like to open it?" },
    );

    switch (choice) {
        case OpenOption.openInCurrentWindow:
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolder), false);
            break;
        case OpenOption.openInNewWindow:
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolder), true);
            break;
    }
}

enum OpenOption {
    openInCurrentWindow = "Open in current window",
    openInNewWindow = "Open in new window"
}