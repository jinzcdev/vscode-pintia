/**
 * 测试用的 vscode 对象伪造工具。
 *
 * 业务代码只依赖 `vscode.TextDocument` 的少量方法（getText / positionAt / lineAt），
 * 因此无需真实文档，构造最小实现即可，避免为每个用例搭建完整 mock。
 */
import * as vscode from "vscode";

/** 构造只实现被测代码所需方法的最小文档对象 */
export function createFakeDocument(text: string): vscode.TextDocument {
    const lines = text.split("\n");
    return {
        getText: () => text,
        positionAt: (offset: number) => {
            const before = text.substring(0, offset);
            const line = before.split("\n").length - 1;
            return { line, character: offset - (before.lastIndexOf("\n") + 1) };
        },
        lineAt: (line: number) => ({
            range: { start: { line, character: 0 }, end: { line, character: lines[line].length } },
        }),
        uri: { fsPath: "/tmp/pintia/1-1-demo.cpp" },
    } as unknown as vscode.TextDocument;
}

/** 构造只实现 getText 的编辑器对象 */
export function createFakeEditor(text: string): vscode.TextEditor {
    return { document: createFakeDocument(text) } as unknown as vscode.TextEditor;
}

/** 设置当前活动编辑器（`undefined` 表示没有打开的编辑器） */
export function setActiveTextEditor(editor: vscode.TextEditor | undefined): void {
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = editor;
}

/** 拼装一份带文件头、代码块与自定义测试样例的题目源文件内容 */
export function createProblemSource(options: { header?: string; code?: string; customTests?: string[] } = {}): string {
    const header = options.header ?? "// @pintia psid=ps1 pid=p1 compiler=GXX";
    const code = options.code ?? "int main() { return 0; }";
    const lines = [header, "// @pintia code=start", code, "// @pintia code=end"];

    for (const test of options.customTests ?? ["1 2"]) {
        lines.push("", "// @pintia test=start", test, "// @pintia test=end");
    }
    return lines.join("\n");
}
