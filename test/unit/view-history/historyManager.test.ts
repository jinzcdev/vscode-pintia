import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { ProblemBasicInfo } from "../../../src/entity/ProblemBasicInfo";
import { HistoryManager } from "../../../src/view-history/historyManager";
import { resetConfigValues, setConfigValue } from "../../setup";

/**
 * 回归背景：预览历史此前只在 dispose() 里落盘，而 VS Code 退出时不保证
 * await 扩展的 dispose，会话内浏览过的题目会丢。现在每次变更都必须立即落盘。
 */
describe("historyManager - 落盘时机与裁剪", () => {
    let tempDir: string;
    let filePath: string;

    function createManager(): HistoryManager {
        return new HistoryManager(filePath);
    }

    function readFile(): Record<string, ProblemBasicInfo[]> {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    function problem(pID: string): ProblemBasicInfo {
        return { pID, psID: "ps1", psName: "题集", title: `T${pID}` };
    }

    beforeEach(() => {
        resetConfigValues();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pintia-hist-"));
        filePath = path.join(tempDir, "view_history.json");
    });

    afterEach(() => {
        resetConfigValues();
        fs.removeSync(tempDir);
    });

    it("新增历史后应立即落盘", async () => {
        const manager = createManager();

        await manager.addProblem("u1", problem("p1"));

        assert.deepStrictEqual(readFile(), { u1: [problem("p1")] });
    });

    it("重复浏览同一题目时应去重并置顶", async () => {
        const manager = createManager();
        await manager.addProblem("u1", problem("p1"));
        await manager.addProblem("u1", problem("p2"));

        await manager.addProblem("u1", problem("p1"));

        assert.deepStrictEqual(
            manager.getProblemHistory("u1").map((p) => p.pID),
            ["p1", "p2"]
        );
        assert.deepStrictEqual(
            readFile().u1.map((p) => p.pID),
            ["p1", "p2"]
        );
    });

    it("超过上限时应裁剪到上限并落盘", async () => {
        setConfigValue("problemHistoryListSize", 2);
        const manager = createManager();

        await manager.addProblem("u1", problem("p1"));
        await manager.addProblem("u1", problem("p2"));
        await manager.addProblem("u1", problem("p3"));

        assert.deepStrictEqual(
            manager.getProblemHistory("u1").map((p) => p.pID),
            ["p3", "p2"]
        );
        assert.deepStrictEqual(
            readFile().u1.map((p) => p.pID),
            ["p3", "p2"]
        );
    });

    it("读取已有文件时应顺带裁剪超限的历史", () => {
        setConfigValue("problemHistoryListSize", 1);
        fs.writeJsonSync(filePath, { u1: [problem("p1"), problem("p2")] });

        const manager = createManager();

        assert.deepStrictEqual(
            manager.getProblemHistory("u1").map((p) => p.pID),
            ["p1"]
        );
    });

    it("构造时不应创建文件", () => {
        createManager();

        assert.strictEqual(fs.existsSync(filePath), false);
    });

    it("文件内容损坏时应降级为空集而不是抛错", () => {
        fs.writeFileSync(filePath, "{not-json");

        const manager = createManager();

        assert.deepStrictEqual(manager.getProblemHistory("u1"), []);
    });

    it("落盘应留下合法 JSON 且不残留临时文件", async () => {
        const manager = createManager();

        await manager.addProblem("u1", problem("p1"));

        assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, "utf-8")));
        assert.strictEqual(fs.existsSync(`${filePath}.tmp`), false);
    });
});
