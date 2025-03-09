import * as vscode from "vscode";
import { submitSolution, testSolution } from "../commands/submit";
import { IPtaCode } from "../shared";

/**
 * 从文本中解析 PTA 代码信息
 * @param data 包含 PTA 代码信息的文本
 * @returns 解析后的 PTA 代码信息对象，如果解析失败则返回 null
 */
export function parseCodeInfo(data: string): IPtaCode | null {
    const matchResult: RegExpMatchArray | null = data.match(/@pintia\s+psid=(\S+)\s+pid=(\S+)\s+compiler=(\S+)/);
    if (!matchResult) {
        return null;
    }
    return {
        psID: matchResult[1],
        pID: matchResult[2],
        compiler: matchResult[3]
    }
}

/**
 * 从文本中解析代码块
 * @param data 包含代码块的文本
 * @param start 代码块开始标记的正则表达式字符串
 * @param end 代码块结束标记的正则表达式字符串
 * @returns 解析出的代码块数组
 */
export function parseCodeBlock(data: string, start: string, end: string): ICodeBlock[] {
    const codeblock: ICodeBlock[] = [];
    const regex = new RegExp(`${start}([\\s\\S]*?)${end}`, 'g');
    let match;
    while ((match = regex.exec(data)) !== null) {
        const code = match[1].trim();
        if (code.length > 0) {
            const startLine = data.substring(0, match.index).split('\n').length;
            codeblock.push({
                lineNum: startLine,
                code: code
            });
        }
    }
    return codeblock;
}

/**
 * 从编辑器内容中解析 PTA 代码信息
 * @returns 解析后的 PTA 代码信息对象，如果解析失败则返回 undefined
 */
export async function getPtaCodeFromActiveEditor(): Promise<IPtaCode | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage(vscode.l10n.t("No active editor found!"));
        return undefined;
    }

    const document = editor.document;
    const content = document.getText();
    const ptaCode = parseCodeInfo(content);
    if (!ptaCode) {
        vscode.window.showErrorMessage(vscode.l10n.t("No valid Pintia problem found in the current file!"));
        return undefined;
    }
    const codeBlocks = parseCodeBlock(
        content,
        "@pintia\\s+code=start\\s*?\\n",
        "\\n[^\\n]*?@pintia\\s+code=end"
    );
    if (codeBlocks.length === 0) {
        vscode.window.showWarningMessage(vscode.l10n.t("The code must be wrapped in `@pintia code=start` and `@pintia code=end`"));
        return undefined;
    }

    ptaCode.code = codeBlocks[0].code;

    const customTests = parseCodeBlock(
        content,
        "@pintia\\s+test=start\\s*?\\n",
        "\\n[^\\n]*?@pintia\\s+test=end"
    );
    ptaCode.customTests = customTests.map((value) => value.code);

    return ptaCode;
}

/**
 * 执行提交解决方案命令
 * 从当前活动编辑器中获取代码并提交
 */
export async function executeSubmitSolution(): Promise<void> {
    const ptaCode = await getPtaCodeFromActiveEditor();
    ptaCode && submitSolution(ptaCode);
}

/**
 * 执行测试解决方案命令
 * 从当前活动编辑器中获取代码并测试
 */
export async function executeTestSolution(): Promise<void> {
    const ptaCode = await getPtaCodeFromActiveEditor();
    ptaCode && testSolution(ptaCode);
}

/**
 * 获取文本中指定正则表达式模式的范围
 * @param document 文本文档
 * @param regex 用于匹配文本的正则表达式
 * @returns 匹配到的范围数组
 */
export function getCodeLensRange(document: vscode.TextDocument, regex: RegExp): vscode.Range[] {
    const text = document.getText();
    const ranges = [];
    let matches;
    while ((matches = regex.exec(text)) !== null) {
        const line = document.positionAt(matches.index).line;
        const textLine = document.lineAt(line);
        textLine?.range && ranges.push(textLine.range);
    }
    return ranges;
}

/**
 * 检测当前活动编辑器是否包含有效的 PTA 代码
 * 如果是，设置上下文变量 pintia.validCodeFile
 */
export function updatePtaValidCodeContext(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.commands.executeCommand('setContext', 'pintia.validCodeFile', false);
        return;
    }

    const document = editor.document;
    if (document.uri.scheme !== 'file') {
        vscode.commands.executeCommand('setContext', 'pintia.validCodeFile', false);
        return;
    }

    const content = document.getText();
    const ptaCode = parseCodeInfo(content);
    vscode.commands.executeCommand('setContext', 'pintia.validCodeFile', !!ptaCode);
}

export interface ICodeBlock {
    /** 代码块的起始行号 */
    lineNum: number;
    /** 代码块的内容 */
    code: string;
}