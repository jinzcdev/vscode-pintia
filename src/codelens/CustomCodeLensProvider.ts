import * as vscode from "vscode";
import { ptaConfig } from "../ptaConfig";
import { IPtaCode, IPtaProblem, TimerState } from "../shared";
import { l10n } from "vscode";
import { parseCodeBlock, parseCodeInfo, getCodeLensRange, ICodeBlock, parseProblemMeta } from "../utils/editorUtils";
import { timerManager } from "../timer/timerManager";

export class CustomCodeLensProvider implements vscode.CodeLensProvider<PtaCodeLens> {
    private onDidChangeCodeLensesEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    get onDidChangeCodeLenses(): vscode.Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<PtaCodeLens[]> {
        const content: string = document.getText();
        const ptaCode: IPtaCode | null = parseCodeInfo(content);
        if (!ptaCode) {
            return undefined;
        }

        // 文件头存在但围栏还没写（例如用户删掉了 code=end）时不能构造 CodeLens：
        // vscode.CodeLens 的 range 为 undefined 不会在构造时报错，会在 VS Code
        // 序列化并渲染透镜时才炸，因此这里必须提前返回。
        const codeEndRanges: vscode.Range[] = getCodeLensRange(document, /@pintia\s+code=end/g);
        if (codeEndRanges.length === 0) {
            return undefined;
        }
        const range: vscode.Range = codeEndRanges[0];
        const codeLens: PtaCodeLens[] = [];

        const shortcuts: string[] = ptaConfig.getEditorShortcuts();
        for (const shortcut of shortcuts ?? []) {
            codeLens.push(new PtaCodeLens(range, document.uri.fsPath, content, shortcut));
        }

        // 保持原有语义：未配置快捷键时，自定义样例的透镜也一并不显示
        if (shortcuts && shortcuts.length > 0) {
            const customTestRanges: vscode.Range[] = getCodeLensRange(document, /@pintia\s+test=start/g);
            for (let i = 0; i < customTestRanges.length; i++) {
                codeLens.push(new PtaCodeLens(customTestRanges[i], document.uri.fsPath, content, "customTest", i));
            }
        }

        // 计时按钮独立于 editor.shortcuts，且放在数组末尾，显示在同行最右侧
        const problem: IPtaProblem = { psID: ptaCode.psID, pID: ptaCode.pID, ...parseProblemMeta(content) };
        codeLens.push(new PtaCodeLens(range, document.uri.fsPath, content, "timer", undefined, problem));
        return codeLens;
    }

    public resolveCodeLens(
        codeLens: PtaCodeLens,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<PtaCodeLens> {
        if (codeLens instanceof PtaCodeLens) {
            const command = codeLens.commandTitle;
            const ptaCode: IPtaCode | null = parseCodeInfo(codeLens.codeContent);
            if (!ptaCode) {
                return codeLens;
            }
            const code: ICodeBlock[] = parseCodeBlock(
                codeLens.codeContent,
                "@pintia\\s+code=start\\s*?\\n",
                "\\n[^\\n]*?@pintia\\s+code=end"
            );
            if (code.length !== 0) {
                ptaCode.code = code[0].code;
            }
            const customTests: ICodeBlock[] = parseCodeBlock(
                codeLens.codeContent,
                "@pintia\\s+test=start\\s*?\\n",
                "\\n[^\\n]*?@pintia\\s+test=end"
            );
            ptaCode.customTests = customTests.map((value, _) => value.code);

            if (command === "Submit") {
                codeLens.command = {
                    title: vscode.l10n.t("Submit"),
                    command: "pintia.submitSolution",
                    arguments: [ptaCode],
                };
            } else if (command === "Test") {
                codeLens.command = {
                    title: l10n.t("Test"),
                    command: "pintia.testSolution",
                    arguments: [ptaCode],
                };
            } else if (command === "customTest") {
                codeLens.command = {
                    title: l10n.t("Test custom sample {0}", codeLens.customTestIndex! + 1),
                    command: "pintia.testCustomSample",
                    arguments: [ptaCode, codeLens.customTestIndex],
                };
            } else if (command === "Preview") {
                codeLens.command = {
                    title: l10n.t("Preview"),
                    command: "pintia.previewProblem",
                    arguments: [ptaCode.psID, ptaCode.pID, false],
                };
            } else if (command === "timer" && codeLens.problem) {
                codeLens.command = {
                    title: this.timerTitle(codeLens.problem),
                    command: "pintia.timerCodeLens",
                    arguments: [codeLens.problem],
                };
            }
        }
        return codeLens;
    }

    /**
     * 计时按钮的文案跟随当前状态：
     * 本题计时中 → 暂停；本题已暂停 → 继续；另一题计时中 → 为本题开始计时。
     */
    private timerTitle(problem: IPtaProblem): string {
        const state = timerManager.getState(problem.psID, problem.pID);
        if (state === TimerState.Running) {
            return l10n.t("Pause Timing");
        }
        if (state === TimerState.Paused) {
            return l10n.t("Resume Timing");
        }
        const active = timerManager.getActiveTimer();
        if (active && (active.psID !== problem.psID || active.pID !== problem.pID)) {
            // CodeLens 空间有限，用比菜单更短的文案；确认框会解释会丢弃旧会话
            return l10n.t("Switch Timing");
        }
        return l10n.t("Start Timing");
    }
}

class PtaCodeLens extends vscode.CodeLens {
    constructor(
        range: vscode.Range,
        public filePath: string,
        public codeContent: string,
        public commandTitle: string,
        public customTestIndex?: number,
        public problem?: IPtaProblem
    ) {
        super(range);
    }
}

export const customCodeLensProvider: CustomCodeLensProvider = new CustomCodeLensProvider();
