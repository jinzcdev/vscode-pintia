import { SEARCH_INDEX_PAGE_SIZE, SEARCH_INDEX_REQUEST_DELAY_MS, ZOJ_PROBLEM_SET_ID } from "./constants";
import { SearchIndexStore } from "./store";
import { ISearchIndexApi, SearchIndexBuildOptions, SearchIndexBuildStats, SearchIndexProblemRecord } from "./types";

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 题目搜索索引构建器：支持全量与增量同步
 */
export class SearchIndexBuilder {
    constructor(
        private readonly api: ISearchIndexApi,
        private readonly store: SearchIndexStore
    ) {}

    public async build(options: SearchIndexBuildOptions): Promise<SearchIndexBuildStats> {
        const stats: SearchIndexBuildStats = {
            problemSetsProcessed: 0,
            problemsAdded: 0,
            pagesFetched: 0,
            typesReset: 0,
        };
        const delayMs = options.delayMs ?? SEARCH_INDEX_REQUEST_DELAY_MS;
        const ignoreZOJ = options.ignoreZOJ ?? true;

        if (options.mode === "full") {
            this.store.clearAll();
        }

        let problemSetIDs = options.problemSetIDs;
        if (!problemSetIDs || problemSetIDs.length === 0) {
            const problemSets = await this.api.getAlwaysAvailableProblemSets(options.cookie, true);
            problemSetIDs = [];
            for (const ps of problemSets) {
                if (ignoreZOJ && ps.id === ZOJ_PROBLEM_SET_ID) {
                    continue;
                }
                problemSetIDs.push(ps.id);
            }
        }

        for (const psID of problemSetIDs) {
            const psName = await this.api.getProblemSetName(psID);
            this.store.upsertProblemSet(psID, psName);
            options.onProgress?.(`${psName} (${psID})`);

            const summaries = await this.api.getProblemSummary(psID, options.cookie);
            const problemTypes = Object.keys(summaries);

            // 新题集未参加 exam 时 exam-problem-list 会 404，拉取前先确保已创建
            let examEnsured = false;

            for (const problemType of problemTypes) {
                const apiTotal = summaries[problemType as keyof typeof summaries]?.total ?? 0;
                if (apiTotal <= 0) {
                    continue;
                }

                let cursor = this.store.getSyncCursor(psID, problemType);
                let syncedCount = cursor?.syncedCount ?? 0;

                // API 总量下降：重置该题型后全量重拉
                if (apiTotal < syncedCount) {
                    this.store.clearProblemType(psID, problemType);
                    syncedCount = 0;
                    stats.typesReset += 1;
                }

                if (options.mode === "incremental" && apiTotal <= syncedCount) {
                    // 更新 api_total 记录，即使无新题
                    this.store.upsertProblems([], psID, problemType, apiTotal, syncedCount);
                    continue;
                }

                if (!examEnsured) {
                    await this.api.ensureProblemSetExam(psID, options.cookie);
                    examEnsured = true;
                }

                const startPage = Math.floor(syncedCount / SEARCH_INDEX_PAGE_SIZE);
                const endPage = Math.ceil(apiTotal / SEARCH_INDEX_PAGE_SIZE) - 1;
                const startOffset = syncedCount % SEARCH_INDEX_PAGE_SIZE;
                const batch: SearchIndexProblemRecord[] = [];
                let fetchFailed = false;

                for (let page = startPage; page <= endPage; page++) {
                    const pageItems = await this.api.fetchExamProblemPage(
                        psID,
                        problemType,
                        page,
                        SEARCH_INDEX_PAGE_SIZE,
                        options.cookie
                    );
                    stats.pagesFetched += 1;

                    // 期望有数据却拿到空页：接口失败（如未参加 exam 的 404），勿推进游标
                    const expectedOnPage =
                        page < endPage ? SEARCH_INDEX_PAGE_SIZE : apiTotal - page * SEARCH_INDEX_PAGE_SIZE;
                    if (expectedOnPage > 0 && pageItems.length === 0) {
                        fetchFailed = true;
                        break;
                    }

                    let slice = pageItems;
                    if (page === startPage && startOffset > 0) {
                        slice = pageItems.slice(startOffset);
                    }

                    for (const item of slice) {
                        batch.push({
                            psID,
                            pID: item.id,
                            psName,
                            title: item.title,
                            label: item.label,
                            score: item.score,
                            type: item.type,
                        });
                    }

                    // 每页请求后等待，降低触发 429 限流的概率
                    await delay(delayMs);
                }

                if (fetchFailed) {
                    // 保留已成功拉到的题目，但游标只推进到实际写入量
                    if (batch.length > 0) {
                        this.store.upsertProblems(batch, psID, problemType, apiTotal, syncedCount + batch.length);
                        stats.problemsAdded += batch.length;
                    }
                    continue;
                }

                const newSyncedCount = apiTotal;
                if (batch.length > 0) {
                    this.store.upsertProblems(batch, psID, problemType, apiTotal, newSyncedCount);
                    stats.problemsAdded += batch.length;
                } else {
                    this.store.upsertProblems([], psID, problemType, apiTotal, newSyncedCount);
                }
            }

            stats.problemSetsProcessed += 1;
        }

        return stats;
    }
}

/**
 * 便捷方法：打开 store 并执行构建
 */
export async function buildSearchIndex(
    api: ISearchIndexApi,
    options: SearchIndexBuildOptions
): Promise<SearchIndexBuildStats> {
    const store = new SearchIndexStore(options.indexPath);
    try {
        const builder = new SearchIndexBuilder(api, store);
        return await builder.build(options);
    } finally {
        store.close();
    }
}
