import * as assert from "assert";
import { applyTextEdits, findNoteBlock } from "../../../src/utils/noteBlock";

describe("utils/noteBlock - findNoteBlock", () => {
    it("应定位完整的笔记块（行号 0-based）", () => {
        const text = ["int main() {", "/* @pintia note=start", "## 标题", "@pintia note=end */", "}"].join("\n");
        assert.deepStrictEqual(findNoteBlock(text), { startLine: 1, endLine: 3 });
    });

    it("未闭合的笔记块应返回 undefined", () => {
        const text = ["/* @pintia note=start", "## 标题"].join("\n");
        assert.strictEqual(findNoteBlock(text), undefined);
    });

    it("新的 start 应覆盖未配对的旧 start", () => {
        const text = [
            "/* @pintia note=start",
            "第一段（未闭合）",
            "/* @pintia note=start",
            "## 标题",
            "@pintia note=end */",
        ].join("\n");
        assert.deepStrictEqual(findNoteBlock(text), { startLine: 2, endLine: 4 });
    });

    it("应兼容 CRLF 换行", () => {
        const text = ["# @pintia note=start", "- item", "@pintia note=end"].join("\r\n");
        assert.deepStrictEqual(findNoteBlock(text), { startLine: 0, endLine: 2 });
    });

    it("标记只要求出现在行内（与预览解析规则一致）", () => {
        const text = ["x = 1", "''' before @pintia note=start after", "## 标题", "@pintia note=end '''"].join("\n");
        assert.deepStrictEqual(findNoteBlock(text), { startLine: 1, endLine: 3 });
    });
});

describe("utils/noteBlock - applyTextEdits", () => {
    it("应从后往前应用多个互不重叠的编辑", () => {
        // "hello world" -> 替换 hello 为 hi，替换 world 为 earth
        const result = applyTextEdits("hello world", [
            { start: 0, end: 5, newText: "hi" },
            { start: 6, end: 11, newText: "earth" },
        ]);
        assert.strictEqual(result, "hi earth");
    });

    it("支持零长度插入", () => {
        assert.strictEqual(applyTextEdits("abc", [{ start: 1, end: 1, newText: "X" }]), "aXbc");
    });

    it("重叠的编辑应返回 undefined", () => {
        const result = applyTextEdits("abcdef", [
            { start: 1, end: 4, newText: "x" },
            { start: 3, end: 5, newText: "y" },
        ]);
        assert.strictEqual(result, undefined);
    });

    it("越界或非法区间应返回 undefined", () => {
        assert.strictEqual(applyTextEdits("abc", [{ start: 2, end: 9, newText: "x" }]), undefined);
        assert.strictEqual(applyTextEdits("abc", [{ start: 3, end: 2, newText: "x" }]), undefined);
        assert.strictEqual(applyTextEdits("abc", [{ start: -1, end: 1, newText: "x" }]), undefined);
    });
});
