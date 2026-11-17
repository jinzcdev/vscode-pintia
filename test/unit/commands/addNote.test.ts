import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { addProblemNote } from "../../../src/commands/addNote";
import { createFakeDocument, createProblemSource, setActiveTextEditor } from "../../helpers/vscodeFakes";
import { resetVscodeMock } from "../../setup";

function createEditor(text: string): {
    editor: vscode.TextEditor;
    insertSnippet: sinon.SinonStub;
} {
    const insertSnippet = sinon.stub().resolves(true);
    const editor = {
        document: createFakeDocument(text),
        insertSnippet,
    } as unknown as vscode.TextEditor;
    return { editor, insertSnippet };
}

describe("commands/addNote", () => {
    beforeEach(() => {
        resetVscodeMock();
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("没有活动编辑器时不应做任何事", async () => {
        await addProblemNote();

        assert.strictEqual(
            (vscode.window.showInformationMessage as sinon.SinonStub).callCount +
                (vscode.window.showWarningMessage as sinon.SinonStub).callCount,
            0
        );
    });

    it("已有笔记块时应提示且不再插入", async () => {
        const source = [
            "// @pintia psid=ps1 pid=p1 compiler=GXX",
            "// @pintia code=start",
            "/* @pintia note=start",
            "## 标题",
            "@pintia note=end */",
            "// @pintia code=end",
        ].join("\n");
        const { editor, insertSnippet } = createEditor(source);
        setActiveTextEditor(editor);

        await addProblemNote();

        assert.strictEqual(insertSnippet.callCount, 0);
        assert.strictEqual(
            (vscode.window.showInformationMessage as sinon.SinonStub).calledWith(
                "A note block already exists in the current file."
            ),
            true
        );
    });

    it("没有代码块标记时应警告且不插入", async () => {
        const { editor, insertSnippet } = createEditor("int main() { return 0; }");
        setActiveTextEditor(editor);

        await addProblemNote();

        assert.strictEqual(insertSnippet.callCount, 0);
        assert.strictEqual(
            (vscode.window.showWarningMessage as sinon.SinonStub).calledWith(
                "The code must be wrapped in `@pintia code=start` and `@pintia code=end`"
            ),
            true
        );
    });

    it("应在代码块结束标记之前插入笔记块", async () => {
        // 行号依次为：文件头 0、code=start 1、代码 2、code=end 3
        const { editor, insertSnippet } = createEditor(createProblemSource({ customTests: [] }));
        setActiveTextEditor(editor);

        await addProblemNote();

        assert.strictEqual(insertSnippet.callCount, 1);
        const [snippet, position] = insertSnippet.firstCall.args as [vscode.SnippetString, vscode.Position];
        assert.strictEqual((position as unknown as { line: number }).line, 3);
        assert.strictEqual((position as unknown as { character: number }).character, 0);

        // 块注释由 snippet 变量按当前语言展开，结尾换行保证结束标记独占一行
        assert.ok(snippet.value.includes("$BLOCK_COMMENT_START @pintia note=start"));
        assert.ok(snippet.value.includes("@pintia note=end $BLOCK_COMMENT_END"));
        assert.ok(snippet.value.endsWith("\n"));
    });
});
