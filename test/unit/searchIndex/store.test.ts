import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { SEARCH_INDEX_VERSION } from "../../../src/searchIndex/constants";
import { closeSearchIndexStore, getSearchIndexStore, SearchIndexStore } from "../../../src/searchIndex/store";
import { SearchIndexProblemRecord } from "../../../src/searchIndex/types";

/** 构造一条索引条目 */
function record(pID: string, overrides: Partial<SearchIndexProblemRecord> = {}): SearchIndexProblemRecord {
    return {
        psID: "ps1",
        pID,
        psName: "Test Set",
        title: `T${pID}`,
        label: `1-${pID}`,
        score: 10,
        type: "PROGRAMMING",
        ...overrides,
    };
}

describe("SearchIndexStore", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pintia-store-"));
    });

    afterEach(async () => {
        closeSearchIndexStore();
        await fs.remove(tmpDir);
    });

    describe("读写与游标", () => {
        it("索引文件不存在时应为空，且 close 不落盘", () => {
            const indexPath = path.join(tmpDir, "index.json");
            const store = new SearchIndexStore(indexPath);

            assert.strictEqual(store.isEmpty(), true);
            store.close();

            assert.strictEqual(fs.pathExistsSync(indexPath), false, "无变更时不应创建索引文件");
        });

        it("写入题目后应可落盘并被重新加载", () => {
            const indexPath = path.join(tmpDir, "index.json");
            const store = new SearchIndexStore(indexPath);
            store.upsertProblems([record("1"), record("2")], "ps1", "PROGRAMMING", 2, 2);

            assert.strictEqual(store.isEmpty(), false);
            assert.deepStrictEqual(store.getSyncCursor("ps1", "PROGRAMMING"), {
                psID: "ps1",
                problemType: "PROGRAMMING",
                apiTotal: 2,
                syncedCount: 2,
            });
            store.close();

            const saved = fs.readJSONSync(indexPath);
            assert.strictEqual(saved.version, SEARCH_INDEX_VERSION);
            assert.strictEqual(saved.problemSets["ps1|Test Set"].length, 2);

            const reload = new SearchIndexStore(indexPath);
            assert.strictEqual(reload.listProblems().length, 2);
            reload.close();
        });

        it("重复 pID 应覆盖旧值而非追加", () => {
            const store = new SearchIndexStore(path.join(tmpDir, "index.json"));
            store.upsertProblems([record("1"), record("2")], "ps1", "PROGRAMMING", 2, 2);
            store.upsertProblems([record("2", { title: "New", score: 30 }), record("3")], "ps1", "PROGRAMMING", 3, 3);

            const byPID = new Map(store.listProblems().map((p) => [p.pID, p]));
            store.close();

            assert.strictEqual(byPID.size, 3);
            assert.strictEqual(byPID.get("2")?.title, "New");
            assert.strictEqual(byPID.get("2")?.score, 30);
        });

        it("空记录批次仍应更新游标，但不应创建题集条目", () => {
            const store = new SearchIndexStore(path.join(tmpDir, "index.json"));
            store.upsertProblems([], "ps1", "PROGRAMMING", 5, 3);

            assert.deepStrictEqual(store.getSyncCursor("ps1", "PROGRAMMING"), {
                psID: "ps1",
                problemType: "PROGRAMMING",
                apiTotal: 5,
                syncedCount: 3,
            });
            assert.strictEqual(store.isEmpty(), true);
            store.close();
        });

        it("未知题集或题型应返回 undefined 游标", () => {
            const store = new SearchIndexStore(path.join(tmpDir, "index.json"));
            store.upsertProblems([record("1")], "ps1", "PROGRAMMING", 1, 1);

            assert.strictEqual(store.getSyncCursor("ps-unknown", "PROGRAMMING"), undefined);
            assert.strictEqual(store.getSyncCursor("ps1", "CODE_COMPLETION"), undefined);
            store.close();
        });

        it("v2 文件缺少 cursors 字段时应容忍", () => {
            const indexPath = path.join(tmpDir, "index.json");
            fs.writeJsonSync(indexPath, {
                version: SEARCH_INDEX_VERSION,
                problemSets: { "ps1|Test Set": [record("1")] },
            });

            const store = new SearchIndexStore(indexPath);

            assert.strictEqual(store.getSyncCursor("ps1", "PROGRAMMING"), undefined);
            assert.strictEqual(store.listProblems().length, 1);
            store.close();
        });
    });

    describe("clearProblemType", () => {
        it("应只清理指定题型并移除空游标", () => {
            const store = new SearchIndexStore(path.join(tmpDir, "index.json"));
            store.upsertProblems([record("1")], "ps1", "PROGRAMMING", 1, 1);
            store.upsertProblems([record("2", { type: "CODE_COMPLETION" })], "ps1", "CODE_COMPLETION", 1, 1);

            store.clearProblemType("ps1", "PROGRAMMING");

            assert.strictEqual(store.getSyncCursor("ps1", "PROGRAMMING"), undefined);
            assert.ok(store.getSyncCursor("ps1", "CODE_COMPLETION"), "其它题型游标应保留");
            assert.deepStrictEqual(
                store.listProblems().map((p) => p.pID),
                ["2"]
            );
            store.close();
        });

        it("清理未知题集时不应抛错", () => {
            const store = new SearchIndexStore(path.join(tmpDir, "index.json"));
            store.upsertProblems([record("1")], "ps1", "PROGRAMMING", 1, 1);

            assert.doesNotThrow(() => store.clearProblemType("ps-unknown", "PROGRAMMING"));
            assert.strictEqual(store.listProblems().length, 1);
            store.close();
        });
    });

    describe("listProblems", () => {
        it("应按题集 ID 再按题号排序", () => {
            const store = new SearchIndexStore(path.join(tmpDir, "index.json"));
            // 先写入 ps2，验证结果仍以 psID 为主序
            store.upsertProblems(
                [record("3", { label: "1-3" }), record("2", { label: "1-2" })],
                "ps2",
                "PROGRAMMING",
                2,
                2
            );
            store.upsertProblems([record("1", { psName: "Set A" })], "ps1", "PROGRAMMING", 1, 1);

            const problems = store.listProblems();
            store.close();

            assert.deepStrictEqual(
                problems.map((p) => `${p.psID}|${p.label}`),
                ["ps1|1-1", "ps2|1-2", "ps2|1-3"]
            );
        });

        it("无法解析出 psID/psName 的键应被跳过", () => {
            const indexPath = path.join(tmpDir, "index.json");
            fs.writeJsonSync(indexPath, {
                version: SEARCH_INDEX_VERSION,
                cursors: {},
                problemSets: {
                    "ps1|Test Set": [record("1")],
                    "broken-key": [record("2")],
                    "ps2|": [record("3")],
                },
            });

            const store = new SearchIndexStore(indexPath);

            assert.deepStrictEqual(
                store.listProblems().map((p) => p.pID),
                ["1"]
            );
            store.close();
        });
    });

    describe("clearAll", () => {
        it("应清空题目与游标并落盘", () => {
            const indexPath = path.join(tmpDir, "index.json");
            const store = new SearchIndexStore(indexPath);
            store.upsertProblems([record("1")], "ps1", "PROGRAMMING", 1, 1);

            store.clearAll();

            assert.strictEqual(store.isEmpty(), true);
            assert.strictEqual(store.getSyncCursor("ps1", "PROGRAMMING"), undefined);
            store.close();

            const saved = fs.readJSONSync(indexPath);
            assert.deepStrictEqual(saved.problemSets, {});
            assert.deepStrictEqual(saved.cursors, {});
        });
    });

    describe("全局 store 实例", () => {
        it("同一路径应复用实例", () => {
            const indexPath = path.join(tmpDir, "index.json");

            const first = getSearchIndexStore(indexPath);

            assert.strictEqual(getSearchIndexStore(indexPath), first);

            closeSearchIndexStore();
            assert.notStrictEqual(getSearchIndexStore(indexPath), first, "关闭缓存后应重建实例");
        });

        it("切换路径时应关闭旧实例并落盘", () => {
            const firstPath = path.join(tmpDir, "first.json");
            const secondPath = path.join(tmpDir, "second.json");

            const first = getSearchIndexStore(firstPath);
            first.upsertProblems([record("1")], "ps1", "PROGRAMMING", 1, 1);

            const second = getSearchIndexStore(secondPath);

            assert.notStrictEqual(second, first);
            assert.strictEqual(fs.pathExistsSync(firstPath), true, "旧实例应在切换时落盘");
        });
    });
});
