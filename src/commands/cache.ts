import { ptaExecutor } from "../ptaExecutor";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { configPath, legacySearchIndexPath, ptaCache, searchIndexPath } from "../shared";
import { ptaChannel } from "../ptaChannel";
import { ptaApi } from "../utils/api";
import { ptaConfig } from "../ptaConfig";
import { ptaManager } from "../ptaManager";
import { l10n } from "vscode";
import {
    buildSearchIndex,
    closeSearchIndexStore,
    ISearchIndexApi,
    migrateLegacyIndexToV2,
    SearchIndexStore,
} from "../searchIndex";
import { SEARCH_INDEX_JSON_FILE, SEARCH_INDEX_REQUEST_DELAY_MS } from "../searchIndex/constants";

/**
 * 搜索索引内存缓存键
 */
const SEARCH_INDEX_CACHE_KEY = "searchIndexProblems";

/**
 * 将 PtaAPI 适配为索引构建接口
 */
const searchIndexApi: ISearchIndexApi = {
    getAlwaysAvailableProblemSets: (cookie, onlyProgramming) =>
        ptaApi.getAlwaysAvailableProblemSets(cookie, onlyProgramming),
    getProblemSetName: (psID) => ptaApi.getProblemSetName(psID),
    getProblemSummary: (psID, cookie) => ptaApi.getProblemSummary(psID, cookie),
    ensureProblemSetExam: async (psID, cookie) => {
        await ptaApi.checkAndCreateProblemSetExam(psID, cookie);
    },
    fetchExamProblemPage: (psID, problemType, page, limit, cookie) =>
        ptaApi.fetchExamProblemPage(psID, problemType, page, limit, cookie),
};

export async function clearCache(): Promise<void> {
    try {
        await ptaExecutor.clearCache();
        // ptaExecutor 只删除磁盘缓存目录，ptaCache 中的 psID → 名称映射需要单独失效
        await ptaApi.invalidateProblemSetsCache();
        vscode.window.showInformationMessage(l10n.t("Clear the cache of pintia successfully!"));
    } catch (error) {
        await promptForOpenOutputChannel(
            l10n.t("Failed to delete cache. Please check the output channel for details."),
            DialogType.error
        );
    }
}

/**
 * 确保用户目录存在 v2 索引：优先从旧版 v1 迁移，否则复制扩展内种子。
 * 永不写入/删除 legacySearchIndexPath，以保证回退旧版插件时可用。
 */
export async function ensureSearchIndexV2(seedPath?: string): Promise<void> {
    if (await fs.pathExists(searchIndexPath)) {
        return;
    }

    if (await fs.pathExists(legacySearchIndexPath)) {
        migrateLegacyIndexToV2(legacySearchIndexPath, searchIndexPath);
        ptaChannel.info(
            `Migrated legacy search index from ${legacySearchIndexPath} to ${searchIndexPath} (legacy file kept).`
        );
        return;
    }

    if (seedPath && (await fs.pathExists(seedPath))) {
        await fs.copy(seedPath, searchIndexPath);
        ptaChannel.info(`Copy the search index seed to ${searchIndexPath}.`);
    }
}

export async function createProblemSearchIndex(context: vscode.ExtensionContext) {
    await fs.ensureDir(configPath);

    try {
        const seedPath = context.asAbsolutePath(path.join("resources", SEARCH_INDEX_JSON_FILE));
        await ensureSearchIndexV2(seedPath);
    } catch (error: any) {
        ptaChannel.error(error.toString());
    }

    // 打开 v2 索引；若路径上误放了 v1 会在 close 时落盘为 v2
    const store = new SearchIndexStore(searchIndexPath);
    store.close();

    if (ptaConfig.getSearchIndexAutoRefresh()) {
        refreshProblemSearchIndex();
    }
}

export async function refreshProblemSearchIndex(): Promise<void> {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: l10n.t("Fetching the problem search index..."),
            cancellable: false,
        },
        async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
            const ignoredZOJ: boolean = ptaConfig.getSearchIndexIgnoreZOJ();
            try {
                const stats = await buildSearchIndex(searchIndexApi, {
                    mode: "incremental",
                    indexPath: searchIndexPath,
                    cookie: ptaManager.getUserSession()?.cookie,
                    ignoreZOJ: ignoredZOJ,
                    delayMs: SEARCH_INDEX_REQUEST_DELAY_MS,
                    onProgress: (message) => p.report({ message }),
                });

                closeSearchIndexStore();
                ptaCache.del(SEARCH_INDEX_CACHE_KEY);
                ptaChannel.info(
                    `Fetch the problem search index successfully. Added ${stats.problemsAdded} problems, fetched ${stats.pagesFetched} pages.`
                );
            } catch (error: any) {
                ptaChannel.error(error.toString());
                await promptForOpenOutputChannel(
                    l10n.t("Failed to fetch problem search index. Please check the output channel for details."),
                    DialogType.error
                );
            }
        }
    );
}

/**
 * 清除搜索索引内存缓存（测试或刷新后调用）
 */
export function invalidateSearchIndexCache(): void {
    ptaCache.del(SEARCH_INDEX_CACHE_KEY);
}

export { SEARCH_INDEX_CACHE_KEY };
