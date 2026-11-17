import * as vscode from "vscode";
import { l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { applyTextEdits, findNoteBlock, SimpleTextEdit } from "../utils/noteBlock";

/**
 * 用「Markdown 文件的格式化器」格式化当前题目文件里的笔记块。
 *
 * 题目文件的语言是 C/C++/Java 等，`Format Document` 只会调用该语言的格式化器，
 * 不会处理嵌在注释里的 Markdown。因此这里把笔记内容放进一个临时 Markdown
 * 文档，交给 `vscode.executeFormatDocumentProvider`（与格式化 `.md` 文件走同一
 * 套 provider），再把结果写回原文档。
 */
export async function formatProblemNote(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const noteBlock = findNoteBlock(document.getText());
    if (!noteBlock) {
        void vscode.window.showInformationMessage(l10n.t("No @pintia note block found in the current file."));
        return;
    }

    // 连同最后一行的换行一起替换，避免结果把 `@pintia note=end` 挤到上一行
    const noteRange = new vscode.Range(noteBlock.startLine + 1, 0, noteBlock.endLine, 0);
    const noteText = document.getText(noteRange);
    if (!noteText.trim()) {
        void vscode.window.showInformationMessage(l10n.t("The note block is empty."));
        return;
    }

    try {
        const markdownDocument = await vscode.workspace.openTextDocument({
            language: "markdown",
            content: noteText,
        });
        const edits = await vscode.commands.executeCommand<readonly vscode.TextEdit[] | undefined>(
            "vscode.executeFormatDocumentProvider",
            markdownDocument.uri,
            {
                tabSize: typeof editor.options.tabSize === "number" ? editor.options.tabSize : 4,
                insertSpaces: editor.options.insertSpaces !== false,
            }
        );
        // VS Code 的 `executeFormatDocumentProvider` 只返回 provider 产生的非空编辑：
        // 内容已符合格式时（Prettier 返回 `[]`，Markdown All in One 返回 `undefined`）
        // 它同样返回 `undefined`，与「没有安装格式化器」无法区分。因此这里只能把
        // `undefined` / 空数组都当成「无需改动」静默处理，否则再次点击会误报。
        if (!edits || edits.length === 0) {
            return;
        }

        const simpleEdits: SimpleTextEdit[] = edits.map((edit) => ({
            start: markdownDocument.offsetAt(edit.range.start),
            end: markdownDocument.offsetAt(edit.range.end),
            newText: edit.newText,
        }));
        const formatted = applyTextEdits(noteText, simpleEdits);
        if (formatted === undefined) {
            void vscode.window.showWarningMessage(l10n.t("Failed to format the note block."));
            return;
        }

        const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
        // 结尾只保留一个换行，保证 `@pintia note=end` 独占一行；同时沿用文档的 EOL
        const replacement = formatted.replace(/\r\n/g, "\n").replace(/\n*$/, "\n").replace(/\n/g, eol);
        if (replacement !== noteText) {
            await editor.edit((builder) => builder.replace(noteRange, replacement));
        }
    } catch (error: any) {
        ptaChannel.error(error?.toString?.() ?? String(error));
        void vscode.window.showWarningMessage(l10n.t("Failed to format the note block."));
    }
}
