import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { formatProblemNote } from "../../../src/commands/formatNote";
import { resetVscodeMock } from "../../setup";

interface IPosition {
    line: number;
    character: number;
}

/** 与 vscode.TextDocument.offsetAt 等价的最小实现 */
function offsetAt(text: string, position: IPosition): number {
    const lines = text.split("\n");
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
        offset += lines[i].length + 1;
    }
    return offset + position.character;
}

function createDocument(text: string) {
    return {
        getText: (range?: { start: IPosition; end: IPosition }): string =>
            range ? text.slice(offsetAt(text, range.start), offsetAt(text, range.end)) : text,
        offsetAt: (position: IPosition): number => offsetAt(text, position),
        eol: vscode.EndOfLine.LF,
        uri: { fsPath: "/tmp/1-1-demo.cpp" },
    };
}

const SOURCE = [
    "// @pintia psid=ps1 pid=p1 compiler=GXX",
    "/* @pintia note=start",
    "##  标题",
    "@pintia note=end */",
].join("\n");

describe("commands/formatNote", () => {
    let replaceStub: sinon.SinonStub;
    let editStub: sinon.SinonStub;

    beforeEach(() => {
        resetVscodeMock();
        replaceStub = sinon.stub();
        editStub = sinon.stub().callsFake(async (callback: (builder: unknown) => void) => {
            callback({ replace: replaceStub });
            return true;
        });
        (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = {
            document: createDocument(SOURCE),
            options: { tabSize: 4, insertSpaces: true },
            edit: editStub,
        };
        // 命令会把笔记内容放进临时 Markdown 文档，这里返回与内容对应的最小文档
        (vscode.workspace.openTextDocument as sinon.SinonStub).callsFake(async (options: { content: string }) =>
            createDocument(options.content)
        );
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("命令返回 undefined 时不应误报「没有格式化器」", async () => {
        // 回归：`executeFormatDocumentProvider` 只在产生非空编辑时返回数组；
        // 内容已符合格式时它返回 undefined（与未安装格式化器无法区分）
        (vscode.commands.executeCommand as sinon.SinonStub).resolves(undefined);

        await formatProblemNote();

        assert.strictEqual((vscode.window.showInformationMessage as sinon.SinonStub).callCount, 0);
        assert.strictEqual(editStub.callCount, 0);
    });

    it("格式化器返回空编辑（内容已符合格式）时应静默返回", async () => {
        (vscode.commands.executeCommand as sinon.SinonStub).resolves([]);

        await formatProblemNote();

        assert.strictEqual((vscode.window.showInformationMessage as sinon.SinonStub).callCount, 0);
        assert.strictEqual(editStub.callCount, 0);
    });

    it("应把格式化器的编辑应用到笔记内容上", async () => {
        (vscode.commands.executeCommand as sinon.SinonStub).resolves([
            { range: new vscode.Range(0, 0, 0, 6), newText: "## 标题" },
        ]);

        await formatProblemNote();

        assert.strictEqual(replaceStub.callCount, 1);
        const [range, replacement] = replaceStub.firstCall.args as [vscode.Range, string];
        assert.strictEqual(replacement, "## 标题\n");
        // 替换的是笔记内容行（第 3 行到结束标记行之前），而不是整个文档
        assert.strictEqual((range.start as unknown as IPosition).line, 2);
        assert.strictEqual((range.end as unknown as IPosition).line, 3);
    });
});
