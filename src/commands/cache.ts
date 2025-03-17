
import { ptaExecutor } from "../ptaExecutor";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { searchIndexPath, ZOJ_PROBLEM_SET_ID } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { ptaApi } from "../utils/api";
import { ptaConfig } from "../ptaConfig";
import { ptaManager } from "../ptaManager";
import { IProblemSet } from "../entity/IProblemSet";
import { l10n } from "vscode";


export async function clearCache(): Promise<void> {
    try {
        await ptaExecutor.clearCache();
        vscode.window.showInformationMessage(l10n.t("Clear the cache of pintia successfully!"));
    } catch (error) {
        await promptForOpenOutputChannel(l10n.t("Failed to delete cache. Please check the output channel for details."), DialogType.error);
    }
}

export async function createProblemSearchIndex(context: vscode.ExtensionContext) {
    const indexFileDest = searchIndexPath;
    if (!await fs.pathExists(indexFileDest)) {
        const indexFileSrc = context.asAbsolutePath(path.join("resources", "search_index.json"));
        try {
            await fs.copy(indexFileSrc, indexFileDest);
            ptaChannel.info(`Copy the search index to ${indexFileDest}.`);
        } catch (error: any) {
            ptaChannel.error(error.toString());
            await promptForOpenOutputChannel(l10n.t("Failed to copy problem index. Please check the output channel for details."), DialogType.error);
        }
    }
    if (ptaConfig.getSearchIndexAutoRefresh()) {
        refreshProblemSearchIndex();
    }
}

export async function refreshProblemSearchIndex(): Promise<void> {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: l10n.t("Fetching the problem search index..."),
        cancellable: false
    }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
        return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {
            // const ignoredLocked: boolean = ptaConfig.getSearchIndexIgnoreLockedProblemSets();
            const ignoredZOJ: boolean = ptaConfig.getSearchIndexIgnoreZOJ();
            try {

                const problemSets: IProblemSet[] = await ptaApi.getAlwaysAvailableProblemSets(ptaManager.getUserSession()?.cookie);
                const problemSetAllowedIndex: string[] = [];
                for (const pbs of problemSets) {
                    if (ignoredZOJ && pbs.id === ZOJ_PROBLEM_SET_ID) {
                        continue;
                    }
                    problemSetAllowedIndex.push(pbs.id);
                }
                const problemIndex = await ptaApi.getProblemSearchIndex(problemSetAllowedIndex);
                if (Object.keys(problemIndex).length !== 0) {
                    await fs.writeJson(searchIndexPath, problemIndex);
                    ptaChannel.info(`Fetch the problem search index successfully.`);
                } else {
                    await promptForOpenOutputChannel(l10n.t("Failed to fetch problem search index. Please check the output channel for details."), DialogType.error);
                }
                resolve();
            } catch (error: any) {
                reject(error);
            }
        });
    });
}