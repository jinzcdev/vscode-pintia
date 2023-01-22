
import { ptaExecutor } from "../PtaExecutor";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { configPath } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { ptaApi } from "../utils/api";
import { ptaConfig } from "../ptaConfig";


export async function clearCache(): Promise<void> {
    try {
        await ptaExecutor.clearCache();
        vscode.window.showInformationMessage("Clear the cache of pintia successfully!");
    } catch (error) {
        await promptForOpenOutputChannel("Failed to delete cache. Please open the output channel for details.", DialogType.error);
    }
}

export async function createProblemSearchIndex(context: vscode.ExtensionContext) {
    const indexFileDest = path.join(configPath, "searchIndex.json");
    if (!await fs.pathExists(indexFileDest)) {
        const indexFileSrc = context.asAbsolutePath(path.join("resources", "searchIndex.json"));
        try {
            await fs.copy(indexFileSrc, indexFileDest);
            ptaChannel.appendLine(`[INFO] Copy the search index to ${indexFileDest}.`);
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            await promptForOpenOutputChannel("Failed to copy problem index. Please open the output channel for details.", DialogType.error);
        }
    }
    if (ptaConfig.getSearchIndexAutoRefresh()) {
        refreshProblemSearchIndex();
    }
}

export async function refreshProblemSearchIndex(): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Fetching the problem search index...",
        cancellable: false
    }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
        return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
            try {
                let problemSetAllowedIndex: string[] = await ptaApi.getAllProblemSets()
                    .then(data => data.map(ps => ps.id));
                if (ptaConfig.getSearchIndexIgnoreZOJ()) {
                    problemSetAllowedIndex = problemSetAllowedIndex.filter(ps => ps !== "91827364500");
                }
                const problemIndex = await ptaApi.getProblemSearchIndex(problemSetAllowedIndex);
                if (Object.keys(problemIndex).length !== 0) {
                    await fs.writeJson(path.join(configPath, "searchIndex.json"), problemIndex);
                    ptaChannel.appendLine(`[INFO] Fetch the problem search index successfully.`);
                } else {
                    await promptForOpenOutputChannel("Failed to fetch problem search index. Please open the output channel for details.", DialogType.error);
                }
                resolve();
            } catch (error: any) {
                reject(error);
            }
        });
    });
}