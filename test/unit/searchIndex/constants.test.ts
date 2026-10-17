import * as assert from "assert";
import * as fs from "fs-extra";
import * as path from "path";
import {
    LEGACY_SEARCH_INDEX_JSON_FILE,
    SEARCH_INDEX_SEED_JSON_FILE,
    SEARCH_INDEX_V2_JSON_FILE,
} from "../../../src/searchIndex/constants";

/**
 * `SEARCH_INDEX_JSON_FILE` 曾经同时表示「~/.pintia 下的 v1 迁移源」与
 * 「resources/ 下的 v2 种子」，语义被复用了两次。拆开后这里守住三者的关系。
 */
describe("searchIndex/constants - 索引文件名", () => {
    it("legacy 与 v2 文件名应不同", () => {
        assert.notStrictEqual(LEGACY_SEARCH_INDEX_JSON_FILE, SEARCH_INDEX_V2_JSON_FILE);
    });

    it("legacy 与种子同名，靠所在目录区分", () => {
        // 同名是历史巧合：种子文件里装的是 v2 结构
        assert.strictEqual(LEGACY_SEARCH_INDEX_JSON_FILE, SEARCH_INDEX_SEED_JSON_FILE);
    });

    it("种子文件应真实存在于 resources/ 下", () => {
        const seedPath = path.resolve(__dirname, "../../../../resources", SEARCH_INDEX_SEED_JSON_FILE);

        assert.strictEqual(fs.existsSync(seedPath), true, `种子文件缺失: ${seedPath}`);
    });

    it("种子文件应是 v2 结构（而非与旧名相符的 v1）", () => {
        const seedPath = path.resolve(__dirname, "../../../../resources", SEARCH_INDEX_SEED_JSON_FILE);
        const raw = fs.readJSONSync(seedPath);

        assert.strictEqual(raw.version, 2, "种子必须是 v2，否则首次启动会走错迁移分支");
        assert.ok(raw.problemSets, "v2 结构应含 problemSets");
        assert.ok(raw.cursors, "v2 结构应含 cursors");
    });
});
