/**
 * `@pintia note=start` / `@pintia note=end` 笔记块的定位与编辑工具。
 *
 * 笔记内容本身是 Markdown，但所在文件的语言是 C/C++/Java 等；语法高亮由
 * `syntaxes/pintia-note.tmLanguage.json` 注入完成，这里负责给「格式化笔记」
 * 命令找出内容范围并应用格式化器的编辑。
 */
export interface NoteBlock {
    /** `@pintia note=start` 所在行（0-based） */
    startLine: number;
    /** `@pintia note=end` 所在行（0-based） */
    endLine: number;
}

/**
 * 找出第一个完整的笔记块。
 *
 * 与 `ProblemView.parseProblemNote` 的规则保持一致：标记只要求出现在行内，
 * 未配对的 `start` 会在遇到新的 `start` 时被覆盖。
 */
export function findNoteBlock(text: string): NoteBlock | undefined {
    const lines = text.split(/\r?\n/);
    let startLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("@pintia note=start")) {
            startLine = i;
        } else if (startLine !== -1 && lines[i].includes("@pintia note=end")) {
            return { startLine, endLine: i };
        }
    }
    return undefined;
}

export interface SimpleTextEdit {
    start: number;
    end: number;
    newText: string;
}

/**
 * 按偏移量应用一组互不重叠的编辑；重叠、越界或区间非法时返回 `undefined`。
 *
 * 从后往前应用，避免每次编辑都重新计算前面编辑造成的偏移。
 */
export function applyTextEdits(text: string, edits: readonly SimpleTextEdit[]): string | undefined {
    const sorted = [...edits].sort((a, b) => b.start - a.start);
    let result = text;
    let previousStart = text.length;
    for (const edit of sorted) {
        if (edit.start < 0 || edit.end < edit.start || edit.end > text.length || edit.end > previousStart) {
            return undefined;
        }
        result = result.slice(0, edit.start) + edit.newText + result.slice(edit.end);
        previousStart = edit.start;
    }
    return result;
}
