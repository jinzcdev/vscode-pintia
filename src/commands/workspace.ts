
import * as vscode from 'vscode';
import { showDirectorySelectDialog } from '../utils/uiUtils';
import { ptaConfig } from '../ptaConfig';
import * as fs from 'fs-extra';
import { determinePintiaFolder } from '../utils/workspaceUtils';
import { l10n } from 'vscode';
import { IQuickPickItem } from '../shared';

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

    const choice: IQuickPickItem<OpenOptionEnum> | undefined = await vscode.window.showQuickPick(
        [
            { label: l10n.t(OpenOptionEnum.openInCurrentWindow), value: OpenOptionEnum.openInCurrentWindow },
            { label: l10n.t(OpenOptionEnum.openInNewWindow), value: OpenOptionEnum.openInNewWindow }
        ],
        { placeHolder: l10n.t("How would you like to open it?") }
    );

    switch (choice?.value) {
        case OpenOptionEnum.openInCurrentWindow:
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolder), false);
            break;
        case OpenOptionEnum.openInNewWindow:
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolder), true);
            break;
    }
}

enum OpenOptionEnum {
    openInCurrentWindow = "Open in current window",
    openInNewWindow = "Open in new window"
}