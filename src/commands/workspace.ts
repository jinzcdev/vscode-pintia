
import * as vscode from 'vscode';
import { showDirectorySelectDialog } from '../utils/uiUtils';
import { ptaConfig } from '../ptaConfig';

export async function changeWorkspaceFolder() {
    const directory: vscode.Uri[] | undefined = await showDirectorySelectDialog();
    if (!directory || directory.length < 1) {
        return;
    }
    ptaConfig.update("workspaceFolder", directory[0].path);
}