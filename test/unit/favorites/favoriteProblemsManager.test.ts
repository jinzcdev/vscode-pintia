import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { FavoriteProblemsManager } from "../../../src/favorites/favoriteProblemsManager";
import { ProblemBasicInfo } from "../../../src/entity/ProblemBasicInfo";

/**
 * 回归背景：收藏此前只在 dispose() 里落盘，而 VS Code 退出时不保证 await
 * 扩展的 dispose，会话内新增的收藏会丢。现在每次变更都必须立即落盘。
 */
describe("favoriteProblemsManager - 落盘时机", () => {
    let tempDir: string;
    let filePath: string;

    function createManager(): FavoriteProblemsManager {
        return new FavoriteProblemsManager(filePath);
    }

    function readFile(): Record<string, ProblemBasicInfo[]> {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    function problem(pID: string): ProblemBasicInfo {
        return { pID, psID: "ps1", psName: "题集", title: `T${pID}` };
    }

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pintia-fav-"));
        filePath = path.join(tempDir, "favorites.json");
    });

    afterEach(() => {
        fs.removeSync(tempDir);
    });

    it("构造时不应创建文件", () => {
        createManager();

        assert.strictEqual(fs.existsSync(filePath), false, "仅读取不应在磁盘上留下文件");
    });

    it("新增收藏后应立即落盘", async () => {
        const manager = createManager();

        await manager.addFavoriteProblem("u1", problem("p1"));

        assert.deepStrictEqual(readFile(), { u1: [problem("p1")] });
    });

    it("移除收藏后应立即落盘", async () => {
        const manager = createManager();
        await manager.addFavoriteProblem("u1", problem("p1"));
        await manager.addFavoriteProblem("u1", problem("p2"));

        await manager.removeFavoriteProblem("u1", "p1");

        assert.deepStrictEqual(readFile(), { u1: [problem("p2")] });
    });

    it("重复收藏同一题目不应产生重复条目", async () => {
        const manager = createManager();

        await manager.addFavoriteProblem("u1", problem("p1"));
        await manager.addFavoriteProblem("u1", problem("p1"));

        assert.strictEqual(manager.getFavoriteProblems("u1").length, 1);
        assert.strictEqual(readFile().u1.length, 1);
    });

    it("移除不存在的收藏不应改写文件", async () => {
        const manager = createManager();
        await manager.addFavoriteProblem("u1", problem("p1"));
        const before = fs.statSync(filePath).mtimeMs;

        await manager.removeFavoriteProblem("u1", "nope");

        assert.strictEqual(fs.statSync(filePath).mtimeMs, before);
    });

    it("不同用户的收藏应相互隔离", async () => {
        const manager = createManager();

        await manager.addFavoriteProblem("u1", problem("p1"));
        await manager.addFavoriteProblem("u2", problem("p2"));

        assert.deepStrictEqual(
            manager.getFavoriteProblems("u1").map((p) => p.pID),
            ["p1"]
        );
        assert.deepStrictEqual(
            manager.getFavoriteProblems("u2").map((p) => p.pID),
            ["p2"]
        );
    });

    it("应读取已有文件的内容", () => {
        fs.writeJsonSync(filePath, { u1: [problem("p9")] });

        const manager = createManager();

        assert.deepStrictEqual(
            manager.getFavoriteProblems("u1").map((p) => p.pID),
            ["p9"]
        );
        assert.strictEqual(manager.isFavoriteProblem("u1", "p9"), true);
    });

    it("文件内容损坏时应降级为空集而不是抛错", () => {
        fs.writeFileSync(filePath, "{not-json");

        const manager = createManager();

        assert.deepStrictEqual(manager.getFavoriteProblems("u1"), []);
    });

    it("落盘应留下合法 JSON 且不残留临时文件", async () => {
        const manager = createManager();

        await manager.addFavoriteProblem("u1", problem("p1"));

        assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, "utf-8")));
        assert.strictEqual(fs.existsSync(`${filePath}.tmp`), false, "临时文件应已被改名");
    });
});
