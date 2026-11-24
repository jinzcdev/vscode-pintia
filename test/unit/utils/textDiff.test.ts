import * as assert from "assert";
import { buildSideBySideDiff, MAX_DIFF_CELLS, outputsIdentical, outputsMatch } from "../../../src/utils/textDiff";

describe("utils/textDiff - 通过判定", () => {
    it("完全相同时应匹配", () => {
        assert.strictEqual(outputsMatch("1\n2", "1\n2"), true);
    });

    it("应忽略 CRLF、行尾空白与末尾空行", () => {
        assert.strictEqual(outputsMatch("1  \r\n2\t\r\n\r\n", "1\n2\n"), true);
    });

    it("内部空行与行首空白差异不应被忽略", () => {
        assert.strictEqual(outputsMatch("1\n\n2", "1\n2"), false);
        assert.strictEqual(outputsMatch(" 1\n2", "1\n2"), false);
    });

    it("outputsIdentical 只忽略换行符差异", () => {
        assert.strictEqual(outputsIdentical("1\r\n2\r\n", "1\n2\n"), true);
        assert.strictEqual(outputsIdentical("1 \n2", "1\n2"), false);
    });
});

describe("utils/textDiff - 左右对照 diff", () => {
    it("完全相同时所有行应为 equal", () => {
        const rows = buildSideBySideDiff("a\nb", "a\nb");

        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[0].left?.kind, "equal");
        assert.strictEqual(rows[0].right?.kind, "equal");
        assert.strictEqual(rows[1].left?.lineNo, 2);
        assert.strictEqual(rows[1].right?.lineNo, 2);
    });

    it("单行修改应配对为同一行的 removed/added", () => {
        const rows = buildSideBySideDiff("a\nb", "a\nc");

        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[1].left?.kind, "removed");
        assert.strictEqual(rows[1].left?.text, "b");
        assert.strictEqual(rows[1].right?.kind, "added");
        assert.strictEqual(rows[1].right?.text, "c");
        assert.strictEqual(rows[1].left?.lineNo, 2);
        assert.strictEqual(rows[1].right?.lineNo, 2);
    });

    it("新增行后应保持两侧行号独立递增", () => {
        const rows = buildSideBySideDiff("a\nc", "a\nb\nc");

        assert.strictEqual(rows.length, 3);
        assert.strictEqual(rows[1].left, undefined);
        assert.strictEqual(rows[1].right?.kind, "added");
        assert.strictEqual(rows[1].right?.lineNo, 2);
        assert.strictEqual(rows[2].left?.lineNo, 2);
        assert.strictEqual(rows[2].right?.lineNo, 3);
    });

    it("删除行后应保持两侧行号独立递增", () => {
        const rows = buildSideBySideDiff("a\nb\nc", "a\nc");

        assert.strictEqual(rows.length, 3);
        assert.strictEqual(rows[1].left?.kind, "removed");
        assert.strictEqual(rows[1].right, undefined);
        assert.strictEqual(rows[2].left?.lineNo, 3);
        assert.strictEqual(rows[2].right?.lineNo, 2);
    });

    it("仅行尾空白不同时应标记 whitespaceOnly", () => {
        const rows = buildSideBySideDiff("a\nb ", "a\nb");

        assert.strictEqual(rows.length, 2);
        assert.strictEqual(rows[1].whitespaceOnly, true);
    });

    it("输出过大时应降级为整块删除/新增但仍能配对", () => {
        const size = Math.ceil(Math.sqrt(MAX_DIFF_CELLS)) + 2;
        const left = new Array(size).fill("a").join("\n");
        const right = new Array(size).fill("b").join("\n");

        const rows = buildSideBySideDiff(left, right);

        assert.strictEqual(rows.length, size);
        assert.strictEqual(rows[0].left?.kind, "removed");
        assert.strictEqual(rows[0].right?.kind, "added");
    });
});
