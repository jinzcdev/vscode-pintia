
import { ptaExecutor } from "../PtaExecutor";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import * as vscode from "vscode";


export async function clearCache(): Promise<void> {
    try {
        await ptaExecutor.clearCache();
        vscode.window.showInformationMessage("Clear the cache of pintia successfully!");
    } catch (error) {
        await promptForOpenOutputChannel("Failed to delete cache. Please open the output channel for details.", DialogType.error);
    }
}    
