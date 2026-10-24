import * as vscode from "vscode";
import { showDirectorySelectDialog } from "../utils/uiUtils";
import { ptaConfig } from "../ptaConfig";
import * as fs from "fs-extra";
import { determinePintiaFolder } from "../utils/workspaceUtils";
import { l10n } from "vscode";
import { IQuickPickItem, OpenOptionEnum } from "../shared";

export async function changeWorkspaceFolder() {
    const directory: vscode.Uri[] | undefined = await showDirectorySelectDialog();
    if (!directory || directory.length < 1) {
        return;
    }
    // 用 fsPath 而非 path：Windows 上 Uri.path 是 "/c:/..." 形式，写进配置后
    // fs.ensureDir 与 path.join 都会拿到非法路径
    ptaConfig.update("workspaceFolder", directory[0].fsPath);
}

export async function openWorkspace() {
    let workspaceFolder: string = ptaConfig.getWorkspaceFolder().trim();
    if (workspaceFolder === "" || !(await fs.pathExists(workspaceFolder))) {
        workspaceFolder = await determinePintiaFolder();
        if (workspaceFolder === "") {
            return;
        }
    }

    const choice: IQuickPickItem<OpenOptionEnum> | undefined = await vscode.window.showQuickPick(
        [
            { label: l10n.t(OpenOptionEnum.openInCurrentWindow), value: OpenOptionEnum.openInCurrentWindow },
            { label: l10n.t(OpenOptionEnum.openInNewWindow), value: OpenOptionEnum.openInNewWindow },
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
