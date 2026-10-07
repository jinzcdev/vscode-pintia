import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { SEARCH_INDEX_VERSION } from "../../../src/searchIndex/constants";
import { isSearchIndexV2, migrateLegacyIndexToV2, SearchIndexStore } from "../../../src/searchIndex/store";

describe("SearchIndex migration", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pintia-migrate-"));
    });

    afterEach(async () => {
        await fs.remove(tmpDir);
    });

    it("仅有 v1 时应迁移出 v2 且不改写 v1", async () => {
        const legacyPath = path.join(tmpDir, "search_index.json");
        const v2Path = path.join(tmpDir, "search_index.v2.json");
        const v1 = {
            "ps1|Test Set": [{ pID: "1", title: "A", label: "1-1", score: 10, type: "PROGRAMMING" }],
        };
        await fs.writeJson(legacyPath, v1);
        const legacyBefore = await fs.readFile(legacyPath, "utf8");

        migrateLegacyIndexToV2(legacyPath, v2Path);

        const legacyAfter = await fs.readFile(legacyPath, "utf8");
        assert.strictEqual(legacyAfter, legacyBefore);

        const v2 = await fs.readJSON(v2Path);
        assert.strictEqual(v2.version, SEARCH_INDEX_VERSION);
        assert.ok(v2.problemSets["ps1|Test Set"]);
        assert.strictEqual(v2.cursors.ps1.PROGRAMMING.syncedCount, 1);

        const store = new SearchIndexStore(v2Path);
        const problems = store.listProblems();
        store.close();
        assert.strictEqual(problems.length, 1);
        assert.strictEqual(problems[0].title, "A");
    });

    it("已有 v2 时 migrate 不应被调用路径改写 v1（ensure 跳过）", async () => {
        const legacyPath = path.join(tmpDir, "search_index.json");
        const v2Path = path.join(tmpDir, "search_index.v2.json");
        const v1 = {
            "ps1|Old": [{ pID: "1", title: "Old", label: "1-1", score: 10, type: "PROGRAMMING" }],
        };
        const existingV2 = {
            version: SEARCH_INDEX_VERSION,
            updatedAt: "2020-01-01T00:00:00.000Z",
            cursors: { ps1: { PROGRAMMING: { apiTotal: 1, syncedCount: 1 } } },
            problemSets: {
                "ps1|New": [{ pID: "2", title: "New", label: "1-2", score: 20, type: "PROGRAMMING" }],
            },
        };
        await fs.writeJson(legacyPath, v1);
        await fs.writeJson(v2Path, existingV2);
        const legacyBefore = await fs.readFile(legacyPath, "utf8");
        const v2Before = await fs.readFile(v2Path, "utf8");

        // 模拟 ensureSearchIndexV2：v2 已存在则不做任何事
        if (!(await fs.pathExists(v2Path))) {
            migrateLegacyIndexToV2(legacyPath, v2Path);
        }

        assert.strictEqual(await fs.readFile(legacyPath, "utf8"), legacyBefore);
        assert.strictEqual(await fs.readFile(v2Path, "utf8"), v2Before);

        const store = new SearchIndexStore(v2Path);
        const problems = store.listProblems();
        store.close();
        assert.strictEqual(problems.length, 1);
        assert.strictEqual(problems[0].title, "New");
    });

    it("皆无索引时从种子复制得到可用 v2", async () => {
        const v2Path = path.join(tmpDir, "search_index.v2.json");
        const seedPath = path.join(tmpDir, "seed.json");
        const seed = {
            version: SEARCH_INDEX_VERSION,
            updatedAt: "2020-01-01T00:00:00.000Z",
            cursors: { ps1: { PROGRAMMING: { apiTotal: 1, syncedCount: 1 } } },
            problemSets: {
                "ps1|Seed": [{ pID: "9", title: "Seeded", label: "1-1", score: 5, type: "PROGRAMMING" }],
            },
        };
        await fs.writeJson(seedPath, seed);

        if (!(await fs.pathExists(v2Path))) {
            await fs.copy(seedPath, v2Path);
        }

        const store = new SearchIndexStore(v2Path);
        const problems = store.listProblems();
        store.close();
        assert.strictEqual(problems.length, 1);
        assert.strictEqual(problems[0].pID, "9");
        assert.ok(isSearchIndexV2(await fs.readJSON(v2Path)));
    });

    it("非法 JSON 加载时应得到空索引且不抛错", async () => {
        const indexPath = path.join(tmpDir, "broken.json");
        await fs.writeFile(indexPath, "not-json{{{");

        const store = new SearchIndexStore(indexPath);
        assert.ok(store.isEmpty());
        store.close();
    });

    it("isSearchIndexV2 应识别 version 与 problemSets", () => {
        assert.ok(isSearchIndexV2({ version: 2, problemSets: {}, cursors: {} }));
        assert.ok(isSearchIndexV2({ problemSets: {}, cursors: {} }));
        assert.ok(!isSearchIndexV2({ "ps1|A": [] }));
        assert.ok(!isSearchIndexV2(null));
    });
});
