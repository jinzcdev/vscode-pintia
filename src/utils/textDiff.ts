export type DiffLineKind = "equal" | "added" | "removed";

export interface DiffCell {
    text: string;
    lineNo: number;
    kind: DiffLineKind;
}

export interface DiffRow {
    /** 期望输出（左侧） */
    left?: DiffCell;
    /** 实际输出（右侧） */
    right?: DiffCell;
    /** 左右两行只有行尾空白不同 */
    whitespaceOnly?: boolean;
}

/** LCS 的最大 DP 单元数；超过时降级为「整块删除 + 整块新增」 */
export const MAX_DIFF_CELLS = 1_000_000;

const TRAILING_WHITESPACE = /[ \t]+$/;

function splitLines(text: string): string[] {
    const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

/** 比较用的归一化：CRLF→LF、去行尾空白、去末尾空行 */
export function normalizeLines(text: string): string[] {
    const lines = splitLines(text).map((line) => line.replace(TRAILING_WHITESPACE, ""));
    while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

export function outputsMatch(expected: string, actual: string): boolean {
    const left = normalizeLines(expected);
    const right = normalizeLines(actual);
    if (left.length !== right.length) {
        return false;
    }
    return left.every((line, index) => line === right[index]);
}

/** 仅换行符归一化后的严格比较，用于提示「是否真的逐字符一致」 */
export function outputsIdentical(expected: string, actual: string): boolean {
    return (expected ?? "").replace(/\r\n?/g, "\n") === (actual ?? "").replace(/\r\n?/g, "\n");
}

interface IRawRow {
    left?: DiffCell;
    right?: DiffCell;
}

function equalRow(left: string, leftLineNo: number, right: string, rightLineNo: number): IRawRow {
    return {
        left: { text: left, lineNo: leftLineNo, kind: "equal" },
        right: { text: right, lineNo: rightLineNo, kind: "equal" },
    };
}

function diffMiddle(left: string[], right: string[], leftOffset: number, rightOffset: number): IRawRow[] {
    const rows: IRawRow[] = [];
    const m = left.length;
    const n = right.length;

    if (m === 0) {
        for (let j = 0; j < n; j++) {
            rows.push({ right: { text: right[j], lineNo: rightOffset + j + 1, kind: "added" } });
        }
        return rows;
    }
    if (n === 0) {
        for (let i = 0; i < m; i++) {
            rows.push({ left: { text: left[i], lineNo: leftOffset + i + 1, kind: "removed" } });
        }
        return rows;
    }

    if (m * n > MAX_DIFF_CELLS) {
        // 输出过大时放弃 LCS，直接展示为整块替换，至少保证页面可用
        for (let i = 0; i < m; i++) {
            rows.push({ left: { text: left[i], lineNo: leftOffset + i + 1, kind: "removed" } });
        }
        for (let j = 0; j < n; j++) {
            rows.push({ right: { text: right[j], lineNo: rightOffset + j + 1, kind: "added" } });
        }
        return rows;
    }

    const width = n + 1;
    const dp = new Uint32Array((m + 1) * width);
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i * width + j] =
                left[i] === right[j]
                    ? dp[(i + 1) * width + j + 1] + 1
                    : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
        }
    }

    let i = 0;
    let j = 0;
    while (i < m || j < n) {
        if (i < m && j < n && left[i] === right[j]) {
            rows.push(equalRow(left[i], leftOffset + i + 1, right[j], rightOffset + j + 1));
            i++;
            j++;
        } else if (j >= n || (i < m && dp[(i + 1) * width + j] >= dp[i * width + j + 1])) {
            rows.push({ left: { text: left[i], lineNo: leftOffset + i + 1, kind: "removed" } });
            i++;
        } else {
            rows.push({ right: { text: right[j], lineNo: rightOffset + j + 1, kind: "added" } });
            j++;
        }
    }
    return rows;
}

/**
 * 把连续的删除/新增块按位置配对，让单行修改在左右两侧显示为同一行。
 */
function pairRows(rows: IRawRow[]): DiffRow[] {
    const result: DiffRow[] = [];
    let index = 0;
    while (index < rows.length) {
        if (rows[index].left?.kind === "equal") {
            result.push(rows[index]);
            index++;
            continue;
        }

        const lefts: DiffCell[] = [];
        const rights: DiffCell[] = [];
        while (index < rows.length && rows[index].left?.kind !== "equal") {
            if (rows[index].left) {
                lefts.push(rows[index].left!);
            }
            if (rows[index].right) {
                rights.push(rows[index].right!);
            }
            index++;
        }

        const count = Math.max(lefts.length, rights.length);
        for (let k = 0; k < count; k++) {
            const left = lefts[k];
            const right = rights[k];
            result.push({
                left,
                right,
                whitespaceOnly:
                    left !== undefined &&
                    right !== undefined &&
                    left.text.replace(TRAILING_WHITESPACE, "") === right.text.replace(TRAILING_WHITESPACE, ""),
            });
        }
    }
    return result;
}

/** 生成左右对照的逐行 diff；行号按各自侧独立计数 */
export function buildSideBySideDiff(expected: string, actual: string): DiffRow[] {
    const left = splitLines(expected);
    const right = splitLines(actual);

    let start = 0;
    while (start < left.length && start < right.length && left[start] === right[start]) {
        start++;
    }

    let leftEnd = left.length;
    let rightEnd = right.length;
    while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) {
        leftEnd--;
        rightEnd--;
    }

    const rows: IRawRow[] = [];
    for (let i = 0; i < start; i++) {
        rows.push(equalRow(left[i], i + 1, right[i], i + 1));
    }
    rows.push(...diffMiddle(left.slice(start, leftEnd), right.slice(start, rightEnd), start, start));
    for (let k = 0; leftEnd + k < left.length; k++) {
        rows.push(equalRow(left[leftEnd + k], leftEnd + k + 1, right[rightEnd + k], rightEnd + k + 1));
    }

    return pairRows(rows);
}
