import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { SearchIndexBuilder } from "../../src/searchIndex/builder";
import { SEARCH_INDEX_VERSION } from "../../src/searchIndex/constants";
import { SearchIndexStore } from "../../src/searchIndex/store";
import { ISearchIndexApi } from "../../src/searchIndex/types";
import { IProblemSummary } from "../../src/entity/IProblemSummary";

/**
 * 创建 mock API：单个题集、单题型，支持分页
 */
function createMockApi(
    pages: Array<Array<{ id: string; title: string; label: string; score: number; type: string }>>,
    overrides?: Partial<ISearchIndexApi>
): ISearchIndexApi {
    return {
        getAlwaysAvailableProblemSets: async () => [{ id: "ps1", name: "Test Set" }],
        getProblemSetName: async () => "Test Set",
        getProblemSummary: async (): Promise<IProblemSummary> => ({
            PROGRAMMING: { total: pages.flat().length, totalScore: 0, totalInPools: 0 },
        }),
        ensureProblemSetExam: async () => undefined,
        fetchExamProblemPage: async (_psID, _type, page) => pages[page] ?? [],
        ...overrides,
    };
}

describe("SearchIndexBuilder", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pintia-index-"));
    });

    afterEach(async () => {
        await fs.remove(tmpDir);
    });

    it("首次全量构建应写入全部题目", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        const pages = [
            [
                { id: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" },
                { id: "2", title: "B", label: "1-2", score: 10, type: "PROGRAMMING" },
            ],
        ];
        const api = createMockApi(pages);
        const store = new SearchIndexStore(indexPath);
        const builder = new SearchIndexBuilder(api, store);

        const stats = await builder.build({ mode: "full", indexPath, delayMs: 0, ignoreZOJ: true });
        store.close();

        const saved = fs.readJSONSync(indexPath);
        const reload = new SearchIndexStore(indexPath);
        const problems = reload.listProblems();
        reload.close();

        assert.strictEqual(stats.problemsAdded, 2);
        assert.strictEqual(problems.length, 2);
        assert.strictEqual(saved.version, SEARCH_INDEX_VERSION);
        assert.ok(saved.cursors?.ps1?.PROGRAMMING);
    });

    it("增量构建应只拉取新增页", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        const initialPages = [[{ id: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" }]];
        const api1 = createMockApi(initialPages);
        const store1 = new SearchIndexStore(indexPath);
        await new SearchIndexBuilder(api1, store1).build({ mode: "full", indexPath, delayMs: 0 });
        store1.close();

        const extendedPages = [
            [
                { id: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" },
                { id: "2", title: "B", label: "1-2", score: 10, type: "PROGRAMMING" },
            ],
        ];
        let fetchCalls = 0;
        const api2: ISearchIndexApi = createMockApi(extendedPages, {
            getProblemSummary: async () => ({
                PROGRAMMING: { total: 2, totalScore: 0, totalInPools: 0 },
            }),
            fetchExamProblemPage: async (_psID, _type, page) => {
                fetchCalls += 1;
                return extendedPages[page] ?? [];
            },
        });

        const store2 = new SearchIndexStore(indexPath);
        const stats = await new SearchIndexBuilder(api2, store2).build({
            mode: "incremental",
            indexPath,
            delayMs: 0,
        });
        const problems = store2.listProblems();
        store2.close();

        assert.strictEqual(stats.problemsAdded, 1);
        assert.strictEqual(problems.length, 2);
        assert.ok(fetchCalls >= 1);
    });

    it("api_total 下降时应重置该题型", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        const pages = [
            [
                { id: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" },
                { id: "2", title: "B", label: "1-2", score: 10, type: "PROGRAMMING" },
            ],
        ];
        const store = new SearchIndexStore(indexPath);
        await new SearchIndexBuilder(createMockApi(pages), store).build({ mode: "full", indexPath, delayMs: 0 });

        const apiShrunk: ISearchIndexApi = createMockApi(
            [[{ id: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" }]],
            {
                getProblemSummary: async () => ({
                    PROGRAMMING: { total: 1, totalScore: 0, totalInPools: 0 },
                }),
            }
        );

        const stats = await new SearchIndexBuilder(apiShrunk, store).build({
            mode: "incremental",
            indexPath,
            delayMs: 0,
        });
        const problems = store.listProblems();
        store.close();

        assert.ok(stats.typesReset >= 1);
        assert.strictEqual(problems.length, 1);
    });

    it("重复 pID 应去重覆盖", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        const store = new SearchIndexStore(indexPath);
        store.upsertProblemSet("ps1", "Test Set");
        store.upsertProblems(
            [{ psID: "ps1", pID: "1", psName: "Test Set", title: "Old", label: "1-1", score: 10, type: "PROGRAMMING" }],
            "ps1",
            "PROGRAMMING",
            1,
            1
        );
        store.upsertProblems(
            [{ psID: "ps1", pID: "1", psName: "Test Set", title: "New", label: "1-1", score: 20, type: "PROGRAMMING" }],
            "ps1",
            "PROGRAMMING",
            1,
            1
        );

        const problems = store.listProblems();
        store.close();
        assert.strictEqual(problems.length, 1);
        assert.strictEqual(problems[0].title, "New");
        assert.strictEqual(problems[0].score, 20);
    });

    it("拉取前应 ensureProblemSetExam", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        let ensureCalls = 0;
        const api = createMockApi([[{ id: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" }]], {
            ensureProblemSetExam: async () => {
                ensureCalls += 1;
            },
        });
        const store = new SearchIndexStore(indexPath);
        await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
        store.close();
        assert.strictEqual(ensureCalls, 1);
    });

    it("空页失败时不应将游标推进到 apiTotal", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        const api = createMockApi([], {
            getProblemSummary: async () => ({
                PROGRAMMING: { total: 2, totalScore: 0, totalInPools: 0 },
            }),
            fetchExamProblemPage: async () => [],
        });
        const store = new SearchIndexStore(indexPath);
        await new SearchIndexBuilder(api, store).build({ mode: "full", indexPath, delayMs: 0 });
        const cursor = store.getSyncCursor("ps1", "PROGRAMMING");
        store.close();
        assert.ok(!cursor || cursor.syncedCount === 0);
    });

    it("v1 扁平 JSON 加载时应自动升级为 v2 并落盘", async () => {
        const indexPath = path.join(tmpDir, "index.json");
        const v1 = {
            "ps1|Test Set": [{ pID: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" }],
        };
        await fs.writeJson(indexPath, v1);

        const store = new SearchIndexStore(indexPath);
        const raw = store.getRawData();
        store.close();

        assert.strictEqual(raw.version, SEARCH_INDEX_VERSION);
        assert.strictEqual(raw.cursors.ps1.PROGRAMMING.syncedCount, 1);

        const saved = fs.readJSONSync(indexPath);
        assert.strictEqual(saved.version, SEARCH_INDEX_VERSION);
        assert.ok(saved.problemSets["ps1|Test Set"]);
    });
});
