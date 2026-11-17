import * as vscode from "vscode";
import { l10n } from "vscode";

const CODE_START_PATTERN = /@pintia\s+code=start/;
const CODE_END_PATTERN = /@pintia\s+code=end/;

/**
 * 在当前题目文件的代码块末尾插入一个空的笔记块。
 *
 * 笔记块放在 `@pintia code=start` 与 `@pintia code=end` 之间、紧挨着结束标记，
 * 这样它会随代码一起提交到拼题 A（下次预览题目时即可解析出来）。块注释标记
 * 交给 snippet 变量解析，由 VS Code 按当前语言展开（C/C++ 为块注释符号，
 * Python 为三引号等），与 `ptanote` 代码片段的行为保持一致。
 */
export async function addProblemNote(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const content = document.getText();
    // 只允许存在一个笔记块；未闭合的 start 也视为已添加，避免产生嵌套标记
    if (content.includes("@pintia note=start")) {
        void vscode.window.showInformationMessage(l10n.t("A note block already exists in the current file."));
        return;
    }

    const lines = content.split(/\r?\n/);
    const startLine = lines.findIndex((line) => CODE_START_PATTERN.test(line));
    const endLine =
        startLine < 0 ? -1 : lines.findIndex((line, index) => index > startLine && CODE_END_PATTERN.test(line));
    if (startLine < 0 || endLine < 0) {
        void vscode.window.showWarningMessage(
            l10n.t("The code must be wrapped in `@pintia code=start` and `@pintia code=end`")
        );
        return;
    }

    // 结尾的换行不能省略，否则 `@pintia code=end` 会被挤到笔记块结束标记的同一行
    const snippet = new vscode.SnippetString(
        "$BLOCK_COMMENT_START @pintia note=start\n$0\n@pintia note=end $BLOCK_COMMENT_END\n"
    );
    await editor.insertSnippet(snippet, new vscode.Position(endLine, 0));
}
