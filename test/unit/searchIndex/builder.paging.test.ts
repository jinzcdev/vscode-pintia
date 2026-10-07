import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { SearchIndexBuilder } from "../../../src/searchIndex/builder";
import { SEARCH_INDEX_PAGE_SIZE, ZOJ_PROBLEM_SET_ID } from "../../../src/searchIndex/constants";
import { SearchIndexStore } from "../../../src/searchIndex/store";
import { ISearchIndexApi, SearchIndexProblemRecord } from "../../../src/searchIndex/types";
import { IProblemSummary } from "../../../src/entity/IProblemSummary";

interface MockPageItem {
    id: string;
    title: string;
    label: string;
    score: number;
    type: string;
}

/** 生成 total 条题目，供分页接口切片返回 */
function createItems(total: number, prefix = "p"): MockPageItem[] {
    return Array.from({ length: total }, (_, i) => ({
        id: `${prefix}${i}`,
        title: `T${i}`,
        label: `1-${i}`,
        score: 10,
        type: "PROGRAMMING",
    }));
}

interface MockApiOptions {
    problemSets?: Array<{ id: string; name: string }>;
    /** 每个题集的题目总数（决定 summary 与分页数据） */
    totals?: Record<string, number>;
    /** 指定页返回空数组，模拟接口失败 */
    failPage?: (psID: string, page: number) => boolean;
}

/** 构造按 SEARCH_INDEX_PAGE_SIZE 分页的 mock API，并记录请求过的页 */
function createMockApi(options: MockApiOptions = {}) {
    const problemSets = options.problemSets ?? [{ id: "ps1", name: "Test Set" }];
    const totals = options.totals ?? { ps1: 0 };
    const fetchedPages: Array<{ psID: string; page: number }> = [];
    let ensureCalls = 0;
    let alwaysAvailableCalls = 0;
    const pages = new Map<string, MockPageItem[]>();

    for (const ps of problemSets) {
        pages.set(ps.id, createItems(totals[ps.id] ?? 0, `${ps.id}-`));
    }

    const api: ISearchIndexApi = {
        getAlwaysAvailableProblemSets: async () => {
            alwaysAvailableCalls += 1;
            return problemSets;
        },
        getProblemSetName: async (psID) => problemSets.find((ps) => ps.id === psID)?.name ?? "unknown",
        getProblemSummary: async (psID): Promise<IProblemSummary> => {
            const total = totals[psID] ?? 0;
            return total > 0 ? { PROGRAMMING: { total, totalScore: 0, totalInPools: total } } : {};
        },
        ensureProblemSetExam: async () => {
            ensureCalls += 1;
        },
        fetchExamProblemPage: async (psID, _problemType, page, limit) => {
            fetchedPages.push({ psID, page });
            if (options.failPage?.(psID, page)) {
                return [];
            }
            return (pages.get(psID) ?? []).slice(page * limit, (page + 1) * limit);
        },
    };

    return {
        api,
        fetchedPages,
        getEnsureCalls: () => ensureCalls,
        getAlwaysAvailableCalls: () => alwaysAvailableCalls,
    };
}

/** 把已有条目直接写入 store，模拟历史索引 */
function seedRecords(store: SearchIndexStore, count: number, psID = "ps1", psName = "Test Set"): void {
    const records: SearchIndexProblemRecord[] = createItems(count, `${psID}-`).map((item) => ({
        psID,
        pID: item.id,
        psName,
        title: item.title,
        label: item.label,
        score: item.score,
        type: item.type,
    }));
    store.upsertProblems(records, psID, "PROGRAMMING", count, count);
}

describe("SearchIndexBuilder - 分页与游标推进", () => {
    let tmpDir: string;
    let indexPath: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pintia-paging-"));
        indexPath = path.join(tmpDir, "index.json");
    });

    afterEach(async () => {
        await fs.remove(tmpDir);
    });

    it("全量构建应跨页拉取全部题目", async () => {
        const total = SEARCH_INDEX_PAGE_SIZE + 50;
        const { api, fetchedPages } = createMockApi({ totals: { ps1: total } });
        const store = new SearchIndexStore(indexPath);

        const stats = await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
        const problems = store.listProblems();
        store.close();

        assert.strictEqual(stats.problemsAdded, total);
        assert.strictEqual(stats.pagesFetched, 2);
        assert.deepStrictEqual(
            fetchedPages.map((f) => f.page),
            [0, 1]
        );
        assert.strictEqual(problems.length, total);
        assert.strictEqual(problems[0].label, "1-0");
    });

    it("增量构建应从已有游标所在页继续，不重拉历史页", async () => {
        const { api, fetchedPages } = createMockApi({ totals: { ps1: SEARCH_INDEX_PAGE_SIZE + 50 } });
        const store = new SearchIndexStore(indexPath);
        // 已同步满一页
        seedRecords(store, SEARCH_INDEX_PAGE_SIZE);

        const stats = await new SearchIndexBuilder(api, store).build({ mode: "incremental", indexPath, delayMs: 0 });
        const problems = store.listProblems();
        store.close();

        assert.deepStrictEqual(
            fetchedPages.map((f) => f.page),
            [1],
            "只应拉取第 1 页"
        );
        assert.strictEqual(stats.problemsAdded, 50);
        assert.strictEqual(problems.length, SEARCH_INDEX_PAGE_SIZE + 50);
        assert.strictEqual(problems.filter((p) => p.pID === "ps1-0").length, 1, "不应重复写入旧题目");
    });

    it("非整页游标应带页内偏移续拉", async () => {
        const total = SEARCH_INDEX_PAGE_SIZE + 50;
        const { api, fetchedPages } = createMockApi({ totals: { ps1: total } });
        const store = new SearchIndexStore(indexPath);
        seedRecords(store, 150);

        const stats = await new SearchIndexBuilder(api, store).build({ mode: "incremental", indexPath, delayMs: 0 });
        const problems = store.listProblems();
        store.close();

        assert.deepStrictEqual(
            fetchedPages.map((f) => f.page),
            [0, 1],
            "偏移落在第 0 页内，需从第 0 页续拉"
        );
        assert.strictEqual(stats.problemsAdded, total - 150);
        assert.strictEqual(problems.length, total);
        assert.strictEqual(new Set(problems.map((p) => p.pID)).size, total, "不应产生重复条目");
    });

    it("全量构建应清空既有索引", async () => {
        const store = new SearchIndexStore(indexPath);
        seedRecords(store, 3);

        const { api } = createMockApi({ totals: { ps1: 1 } });
        const stats = await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
        const problems = store.listProblems();
        store.close();

        assert.strictEqual(stats.problemsAdded, 1);
        assert.strictEqual(problems.length, 1);
    });

    it("中途某页返回空时应保留已抓取题目，游标只推进到实际写入量", async () => {
        const total = SEARCH_INDEX_PAGE_SIZE + 50;
        const { api } = createMockApi({
            totals: { ps1: total },
            failPage: (_psID, page) => page === 1,
        });
        const store = new SearchIndexStore(indexPath);

        const stats = await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
        const cursor = store.getSyncCursor("ps1", "PROGRAMMING");
        const problems = store.listProblems();
        store.close();

        assert.strictEqual(stats.problemsAdded, SEARCH_INDEX_PAGE_SIZE);
        assert.strictEqual(problems.length, SEARCH_INDEX_PAGE_SIZE);
        assert.strictEqual(cursor?.apiTotal, total);
        assert.strictEqual(cursor?.syncedCount, SEARCH_INDEX_PAGE_SIZE, "游标不应推进到 apiTotal");
    });

    it("summary 中 total 为 0 的题集应跳过且不写游标", async () => {
        const { api, getEnsureCalls } = createMockApi({ totals: { ps1: 0 } });
        const store = new SearchIndexStore(indexPath);

        const stats = await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
        const cursor = store.getSyncCursor("ps1", "PROGRAMMING");
        store.close();

        assert.strictEqual(stats.problemsAdded, 0);
        assert.strictEqual(stats.problemSetsProcessed, 1);
        assert.strictEqual(cursor, undefined);
        assert.strictEqual(getEnsureCalls(), 0, "无题目时不应创建 exam");
    });

    describe("题集筛选", () => {
        it("默认应跳过 ZOJ 题集", async () => {
            const { api } = createMockApi({
                problemSets: [
                    { id: ZOJ_PROBLEM_SET_ID, name: "ZOJ" },
                    { id: "ps1", name: "Test Set" },
                ],
                totals: { [ZOJ_PROBLEM_SET_ID]: 2, ps1: 1 },
            });
            const store = new SearchIndexStore(indexPath);

            await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
            const problems = store.listProblems();
            store.close();

            assert.deepStrictEqual([...new Set(problems.map((p) => p.psID))], ["ps1"]);
        });

        it("ignoreZOJ 为 false 时应包含 ZOJ 题集", async () => {
            const { api } = createMockApi({
                problemSets: [
                    { id: ZOJ_PROBLEM_SET_ID, name: "ZOJ" },
                    { id: "ps1", name: "Test Set" },
                ],
                totals: { [ZOJ_PROBLEM_SET_ID]: 2, ps1: 1 },
            });
            const store = new SearchIndexStore(indexPath);

            await new SearchIndexBuilder(api, store).build({
                mode: "full",
                indexPath,
                delayMs: 0,
                ignoreZOJ: false,
            });
            const problems = store.listProblems();
            store.close();

            assert.deepStrictEqual(new Set(problems.map((p) => p.psID)), new Set(["ps1", ZOJ_PROBLEM_SET_ID]));
        });

        it("显式指定 problemSetIDs 时不应请求 always-available 列表", async () => {
            const { api, getAlwaysAvailableCalls } = createMockApi({ totals: { ps1: 2 } });
            const store = new SearchIndexStore(indexPath);

            const stats = await new SearchIndexBuilder(api, store).build({
                mode: "full",
                indexPath,
                delayMs: 0,
                problemSetIDs: ["ps1"],
            });
            store.close();

            assert.strictEqual(getAlwaysAvailableCalls(), 0);
            assert.strictEqual(stats.problemsAdded, 2);
        });
    });

    it("onProgress 应回报当前处理的题集", async () => {
        const { api } = createMockApi({ totals: { ps1: 1 } });
        const store = new SearchIndexStore(indexPath);
        const messages: string[] = [];

        await new SearchIndexBuilder(api, store).build({
            mode: "full",
            indexPath,
            delayMs: 0,
            onProgress: (message) => messages.push(message),
        });
        store.close();

        assert.deepStrictEqual(messages, ["Test Set (ps1)"]);
    });
});
