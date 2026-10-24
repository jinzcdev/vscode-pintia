import * as vscode from "vscode";
import { l10n } from "vscode";
import { IProblemConfig } from "../entity/IProblem";
import { IProblemInfo } from "../entity/IProblemInfo";
import { getGlobalContext } from "../globalContext";
import { compilerLangMapping } from "../shared";
import { ptaApi } from "../utils/api";
import { escapeHtml } from "../utils/stringUtils";
import { IWebViewMessage } from "./PtaWebview";
import { PtaWebviewWithCodeStyle } from "./PtaWebviewWithCodeStyle";
import * as markdownEngine from "./markdownEngine";
import { ProblemView } from "./views/ProblemView";

export class PtaPreviewProvider extends PtaWebviewWithCodeStyle<ProblemView> {
    private static instance: PtaPreviewProvider | null = null;

    public static createOrUpdate(view: ProblemView): PtaPreviewProvider {
        if (!PtaPreviewProvider.instance) {
            PtaPreviewProvider.instance = new PtaPreviewProvider(view);
        }
        PtaPreviewProvider.instance.updateView(view);
        return PtaPreviewProvider.instance;
    }

    protected async loadViewData(problem: ProblemView): Promise<void> {
        await problem.fetch();
        this.data = {
            title: `${problem.label} ${problem.title}`,
            ptaCode: ProblemView.toPtaNode(problem),
            problem: problem,
            previous: problem.getAdjacentProblemInfo("previous"),
            next: problem.getAdjacentProblemInfo("next"),
        };
    }

    private formatMarkdown(str: string): string {
        // \u8F93\u5165\u6837 -> 输入样例
        return str.replace(/###\s(\u8F93\u5165\u6837|Sample\sIn)/g, "\n\n------\n\n### $1");
    }

    protected getContent(): string {
        const problem = this.data.problem as ProblemView;
        const keyword: string = `${problem.label} ${problem.title}`.replace(/ /g, "+");
        const copyButtonScriptUri = this.getWebview()?.asWebviewUri(
            vscode.Uri.joinPath(getGlobalContext().extensionUri, "media", "main.js")
        );
        const problemConfig = problem.problemConfig as IProblemConfig;

        const performanceHtml = this.generatePerformanceHtml(problemConfig);
        const navHtml = this.generateProblemNav(problem);

        return `
        <div class="header">
            <div class="problem-title">
            <h1><a href="${ptaApi.getProblemURL(problem.problemSetId, problem.id, problem.type)}" target="_blank">${escapeHtml(problem.title)}</a></h1>
            </div>
            <div class="problem-set-name">
            <a href="${ptaApi.getProblemSetURL(problem.problemSetId)}" target="_blank">${escapeHtml(problem.problemSetName)}</a>
            </div>
        </div>

        <div class="banner">
            <div class="ques-info">
            <div class="detail">${l10n.t("Score")} ${problem.score} &nbsp; ${l10n.t("Submissions")} ${problem.submitCount} &nbsp; ${l10n.t("Accepted Count")} ${problem.acceptCount} &nbsp; ${l10n.t("Acceptance Rate")} ${problem.submitCount === 0 ? 0 : ((problem.acceptCount / problem.submitCount) * 100).toFixed(2)}%</div>
            <div class="department">${l10n.t("Author")} ${escapeHtml(problem.author)} &nbsp;&nbsp;&nbsp; ${l10n.t("Organization")} ${escapeHtml(problem.organization)}</div>
            </div>
            <hr class="banner-line"></hr>
        </div>

        <div class="content-container">
            ${markdownEngine.render(this.formatMarkdown(problem.content))}


            ${
                problem.problemNote
                    ? `
                <h3>${l10n.t("My Notes")}</h3>
                <div class="pta-note">
                    ${markdownEngine.render(problem.problemNote)}
                </div>
            `
                    : ""
            }

            ${
                performanceHtml
                    ? `
                <details class="performance-details" open>
                    <summary><strong>${l10n.t("Performance Requirements")}</strong></summary>
                    <div class="performance-content">
                        ${performanceHtml}
                    </div>
                </details>
            `
                    : ""
            }

            ${markdownEngine.render(
                [
                    l10n.t("Search:") +
                        " " +
                        [
                            `[${l10n.t("Google")}](https://www.google.com/search?q=${keyword})`,
                            `[${l10n.t("Bing")}](https://cn.bing.com/search?q=${keyword})`,
                            `[${l10n.t("Baidu")}](https://www.baidu.com/s?wd=${keyword})`,
                            `[${l10n.t("Reference Code (partial problems only)")}](https://github.com/jinzcdev/PTA/tree/main/${this.formatProblemSetName(problem.problemSetName)})`,
                        ].join(" | "),
                    "<hr>",
                ].join("\n")
            )}

            ${
                problem.lastProgram.trim().length
                    ? markdownEngine.render(
                          [
                              `### ${l10n.t("Last Submission")} ${problem.lastSubmittedLang.trim().length ? "(" + problem.lastSubmittedLang + ")" : ""}`,
                              "```" + problem.lastSubmittedLang,
                              problem.lastProgram.replace(/```/g, "\\```"),
                              "```",
                          ].join("\n")
                      )
                    : ""
            }
        </div>

        <div class="button-container">
            ${navHtml}
            <button id="btnCheckLastSubmission">${l10n.t("View Last Submission")}</button>
            <button id="btnSolve" title="⌘/Ctrl+Enter">${l10n.t("Start Coding")}</button>
            <div class="right-buttons">
                <button id="btnMoreActions" class="more-actions-trigger">
                    <span class="more-actions-icon">⋯</span>
                </button>
                <div class="more-actions-menu">
                    <button id="btnCopyProblemContent">${l10n.t("Copy Problem Content")}</button>
                    <button id="btnUpdate">${l10n.t("Refresh Problem")}</button>
                    <button id="btnOpenGuide">${l10n.t("View User Guide")}</button>
                </div>
            </div>
        </div>
        <script nonce="${this.nonce}" src="${copyButtonScriptUri}"></script>`;
    }

    /**
     * 上一题 / 下一题导航。
     *
     * 列表来自 ProblemView 的完整题型列表；当前题不在列表中或两侧都没有相邻题时
     * 整条隐藏，只有一侧时禁用对应按钮。
     */
    private generateProblemNav(problem: ProblemView): string {
        const previous = this.data.previous as IProblemInfo | undefined;
        const next = this.data.next as IProblemInfo | undefined;
        if (!previous && !next) {
            return "";
        }

        const psID = escapeHtml(problem.problemSetId);
        const prevAttrs = previous ? `data-psid="${psID}" data-pid="${escapeHtml(previous.id)}"` : "disabled";
        const nextAttrs = next ? `data-psid="${psID}" data-pid="${escapeHtml(next.id)}"` : "disabled";
        const prevLabel = escapeHtml(l10n.t("Previous Problem"));
        const nextLabel = escapeHtml(l10n.t("Next Problem"));

        return `
            <div class="nav-buttons">
                <button id="btnPrevProblem" class="nav-button" ${prevAttrs} title="${prevLabel}" aria-label="${prevLabel}">
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"
                            stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
                <button id="btnNextProblem" class="nav-button" ${nextAttrs} title="${nextLabel}" aria-label="${nextLabel}">
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"
                            stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
            </div>`;
    }

    private generatePerformanceHtml(problemConfig: IProblemConfig | undefined): string {
        if (!problemConfig) return "";

        const {
            codeSizeLimit = -1,
            timeLimit = -1,
            memoryLimit = -1,
            stackSizeLimit = -1,
            customizeLimits = [],
        } = problemConfig;
        let result = "";

        const limitTypesInCustomLimits = new Set<string>();

        customizeLimits.forEach((limit) => {
            Object.entries(limit).forEach(([key, value]) => {
                if (value !== undefined && key.endsWith("Limit")) {
                    limitTypesInCustomLimits.add(key);
                }
            });
        });

        // 显示通用的限制条件（不在customizeLimits中出现的）
        const generateLimitIfNeeded = (key: string, label: string, value: number, unit: string) => {
            if (value !== -1 && !limitTypesInCustomLimits.has(key)) {
                result += this.generateLimitHtml(label, `${value} ${unit}`);
            }
        };

        generateLimitIfNeeded("codeSizeLimit", l10n.t("Code Size Limit"), codeSizeLimit, "KB");
        generateLimitIfNeeded("timeLimit", l10n.t("Time Limit"), timeLimit, "ms");
        generateLimitIfNeeded("memoryLimit", l10n.t("Memory Limit"), memoryLimit / 1024, "MB");
        generateLimitIfNeeded("stackSizeLimit", l10n.t("Stack Limit"), stackSizeLimit, "KB");

        if (customizeLimits.length > 0) {
            // 添加每个自定义编译器的限制
            customizeLimits.forEach((limit) => {
                const compiler = limit.compiler;
                const compilerName = compilerLangMapping.get(compiler) || compiler;

                result += `<div class="performance-compiler">${compilerName}</div>`;

                const generateCustomLimitIfNeeded = (
                    key: string,
                    label: string,
                    value: number | undefined,
                    unit: string
                ) => {
                    if (value !== undefined && value !== -1) {
                        result += this.generateLimitHtml(label, `${value} ${unit}`);
                    }
                };

                generateCustomLimitIfNeeded("timeLimit", l10n.t("Time Limit"), limit.timeLimit, "ms");
                generateCustomLimitIfNeeded("memoryLimit", l10n.t("Memory Limit"), limit.memoryLimit / 1024, "MB");
                generateCustomLimitIfNeeded("stackSizeLimit", l10n.t("Stack Limit"), limit.stackSizeLimit, "KB");
                generateCustomLimitIfNeeded("codeSizeLimit", l10n.t("Code Size Limit"), limit.codeSizeLimit, "KB");
            });

            // 添加默认/其他编译器的限制
            const hasDefaultLimits = ["timeLimit", "memoryLimit", "stackSizeLimit", "codeSizeLimit"].some(
                (key) => limitTypesInCustomLimits.has(key) && problemConfig[key as keyof IProblemConfig] !== -1
            );

            if (hasDefaultLimits) {
                result += `<div class="performance-compiler">${l10n.t("Other Compilers")}</div>`;

                generateLimitIfNeeded("timeLimit", l10n.t("Time Limit"), timeLimit, "ms");
                generateLimitIfNeeded("memoryLimit", l10n.t("Memory Limit"), memoryLimit / 1024, "MB");
                generateLimitIfNeeded("stackSizeLimit", l10n.t("Stack Limit"), stackSizeLimit, "KB");
                generateLimitIfNeeded("codeSizeLimit", l10n.t("Code Size Limit"), codeSizeLimit, "KB");
            }
        }

        return result;
    }

    private generateLimitHtml(key: string, value: string): string {
        return `<div class="performance-item"><span class="key">${key}</span><span class="value">${value}</span></div>`;
    }

    protected async onDidReceiveMessage(msg: IWebViewMessage): Promise<void> {
        switch (msg.type) {
            case "command":
                if (msg.value === "pintia.codeProblem") {
                    await vscode.commands.executeCommand("pintia.codeProblem", this.data.ptaCode);
                } else if (msg.value === "pintia.previewProblem") {
                    await vscode.commands.executeCommand(
                        "pintia.previewProblem",
                        this.data.ptaCode.psID,
                        this.data.ptaCode.pID,
                        false
                    );
                } else if (msg.value === "pintia.previewProblemById") {
                    const [psID, pID] = (msg.args ?? []) as string[];
                    if (psID && pID) {
                        await vscode.commands.executeCommand("pintia.previewProblem", psID, pID, false);
                    }
                } else if (msg.value === "pintia.checkLastSubmission") {
                    await vscode.commands.executeCommand("pintia.checkLastSubmission", this.data.ptaCode);
                } else if (msg.value === "pintia.copyContent") {
                    const content = this.data.problem.content;
                    vscode.env.clipboard.writeText(content).then(() => {
                        vscode.window.showInformationMessage(vscode.l10n.t("Successfully copied to the clipboard!"));
                    });
                } else if (msg.value === "pintia.openGuide") {
                    await vscode.commands.executeCommand("pintia.welcome");
                }
                break;
            case "text":
                vscode.window.showInformationMessage(msg.value);
                break;
            default:
                await super.onDidReceiveMessage(msg);
        }
    }

    private formatProblemSetName(name: string): string {
        name = name
            .replace(/\uFF08|\uFF09/g, (match) => (match === "\uFF08" ? "(" : ")")) // "（）" -> "\uFF08\uFF09"
            .replace(/[\u3000-\u303F\s\-\uFF1A\u300A\u300B\u2014\u3001]/g, "_") // "《》—、：" -> "\uFF1A\u300A\u300B\u2014\u3001"
            .replace(/^_+|_+$/g, "")
            .replace(/_+/g, "_");
        return name;
    }
}
