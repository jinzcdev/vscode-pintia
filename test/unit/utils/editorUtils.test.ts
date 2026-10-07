import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
    getCodeLensRange,
    getPtaCodeFromActiveEditor,
    parseCodeBlock,
    parseCodeInfo,
} from "../../../src/utils/editorUtils";
import { createFakeDocument, createFakeEditor, setActiveTextEditor } from "../../helpers/vscodeFakes";
import { resetVscodeMock } from "../../setup";

const CODE_START = "@pintia\\s+code=start\\s*?\\n";
const CODE_END = "\\n[^\\n]*?@pintia\\s+code=end";

describe("editorUtils", () => {
    beforeEach(() => {
        resetVscodeMock();
    });

    afterEach(() => {
        resetVscodeMock();
    });

    describe("parseCodeInfo", () => {
        it("应解析出 psid、pid 与 compiler", () => {
            const info = parseCodeInfo("  @pintia psid=2048 pid=12345 compiler=GXX");

            assert.deepStrictEqual(info, { psID: "2048", pID: "12345", compiler: "GXX" });
        });

        it("标记前后的其它内容不应影响解析", () => {
            const info = parseCodeInfo("/*\n * @pintia psid=ps1 pid=p1 compiler=GCC\n */\nint main() {}");

            assert.strictEqual(info?.psID, "ps1");
            assert.strictEqual(info?.pID, "p1");
            assert.strictEqual(info?.compiler, "GCC");
        });

        it("多个连续空白应被容忍", () => {
            const info = parseCodeInfo("@pintia    psid=ps1   pid=p1     compiler=PYTHON3");

            assert.strictEqual(info?.compiler, "PYTHON3");
        });

        it("缺少 compiler 时应返回 null", () => {
            assert.strictEqual(parseCodeInfo("@pintia psid=ps1 pid=p1"), null);
        });

        it("无文件头时应返回 null", () => {
            assert.strictEqual(parseCodeInfo("int main() { return 0; }"), null);
        });
    });

    describe("parseCodeBlock", () => {
        it("应解析出代码块内容与起始行号", () => {
            const content = ["line1", "// @pintia code=start", "int a;", "int b;", "// @pintia code=end"].join("\n");

            const blocks = parseCodeBlock(content, CODE_START, CODE_END);

            assert.strictEqual(blocks.length, 1);
            assert.strictEqual(blocks[0].lineNum, 2);
            assert.strictEqual(blocks[0].code, "int a;\nint b;");
        });

        it("应解析出多个代码块", () => {
            const content = [
                "// @pintia test=start",
                "1 2",
                "// @pintia test=end",
                "",
                "// @pintia test=start",
                "3 4",
                "// @pintia test=end",
            ].join("\n");

            const blocks = parseCodeBlock(content, "@pintia\\s+test=start\\s*?\\n", "\\n[^\\n]*?@pintia\\s+test=end");

            assert.deepStrictEqual(
                blocks.map((b) => b.code),
                ["1 2", "3 4"]
            );
        });

        it("内容为纯空白的代码块应被忽略", () => {
            const content = ["// @pintia code=start", "   ", "", "// @pintia code=end"].join("\n");

            assert.deepStrictEqual(parseCodeBlock(content, CODE_START, CODE_END), []);
        });

        it("无匹配时应返回空数组", () => {
            assert.deepStrictEqual(parseCodeBlock("int main() {}", CODE_START, CODE_END), []);
        });
    });

    describe("getCodeLensRange", () => {
        it("应为每个匹配返回其所在行", () => {
            const content = ["// @pintia code=end", "int a;", "// @pintia code=end"].join("\n");

            const ranges = getCodeLensRange(createFakeDocument(content), /@pintia\s+code=end/g);

            assert.strictEqual(ranges.length, 2);
            assert.deepStrictEqual(
                ranges.map((r) => (r as unknown as { start: { line: number } }).start.line),
                [0, 2]
            );
        });

        it("无匹配时应返回空数组", () => {
            assert.deepStrictEqual(getCodeLensRange(createFakeDocument("int a;"), /@pintia\s+code=end/g), []);
        });
    });

    describe("getPtaCodeFromActiveEditor", () => {
        it("无活动编辑器时应提示错误并返回 undefined", async () => {
            setActiveTextEditor(undefined);

            const result = await getPtaCodeFromActiveEditor();

            assert.strictEqual(result, undefined);
            assert.strictEqual((vscode.window.showErrorMessage as sinon.SinonStub).called, true);
        });

        it("内容缺少文件头时应提示错误并返回 undefined", async () => {
            setActiveTextEditor(createFakeEditor("int main() {}"));

            const result = await getPtaCodeFromActiveEditor();

            assert.strictEqual(result, undefined);
            assert.strictEqual((vscode.window.showErrorMessage as sinon.SinonStub).called, true);
        });

        it("缺少代码块时应提示警告并返回 undefined", async () => {
            setActiveTextEditor(createFakeEditor("// @pintia psid=ps1 pid=p1 compiler=GXX\nint main() {}"));

            const result = await getPtaCodeFromActiveEditor();

            assert.strictEqual(result, undefined);
            assert.strictEqual((vscode.window.showWarningMessage as sinon.SinonStub).called, true);
        });

        it("应解析出代码与自定义测试样例", async () => {
            const content = [
                "/*",
                " * @pintia psid=ps1 pid=p1 compiler=GXX",
                " */",
                "// @pintia code=start",
                "int main() { return 0; }",
                "// @pintia code=end",
                "",
                "// @pintia test=start",
                "1 2",
                "// @pintia test=end",
            ].join("\n");
            setActiveTextEditor(createFakeEditor(content));

            const result = await getPtaCodeFromActiveEditor();

            assert.strictEqual(result?.psID, "ps1");
            assert.strictEqual(result?.pID, "p1");
            assert.strictEqual(result?.compiler, "GXX");
            assert.strictEqual(result?.code, "int main() { return 0; }");
            assert.deepStrictEqual(result?.customTests, ["1 2"]);
        });

        it("存在多个代码块时应只取第一个", async () => {
            const content = [
                "// @pintia psid=ps1 pid=p1 compiler=GXX",
                "// @pintia code=start",
                "first",
                "// @pintia code=end",
                "// @pintia code=start",
                "second",
                "// @pintia code=end",
            ].join("\n");
            setActiveTextEditor(createFakeEditor(content));

            const result = await getPtaCodeFromActiveEditor();

            assert.strictEqual(result?.code, "first");
        });
    });
});
