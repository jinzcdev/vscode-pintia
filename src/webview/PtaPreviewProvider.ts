import * as vscode from "vscode";
import { IProblemConfig } from "../entity/IProblem";
import { getGlobalContext } from "../extension";
import { compilerLangMapping } from '../shared';
import { ptaApi } from "../utils/api";
import { getNonce, IWebViewMessage } from "./PtaWebview";
import { PtaWebviewWithCodeStyle } from "./PtaWebviewWithCodeStyle";
import * as markdownEngine from './markdownEngine';
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
            problem: problem
        };
    }

    private formatMarkdown(str: string): string {
        // \u8F93\u5165\u6837 -> 输入样例
        return str.replace(/###\s(\u8F93\u5165\u6837|Sample\sIn)/g, '\n\n------\n\n### $1');
    }

    protected getContent(): string {
        const problem = this.data.problem as ProblemView;
        const keyword: string = `${problem.label} ${problem.title}`.replace(/ /g, '+');
        const copyButtonScriptUri = this.getWebview()?.asWebviewUri(vscode.Uri.joinPath(getGlobalContext().extensionUri, "media", "main.js"));
        const problemConfig = problem.problemConfig as IProblemConfig;

        const performanceHtml = this.generatePerformanceHtml(problemConfig);

        return `
        <div class="header">
            <div class="problem-title">
            ${markdownEngine.render(`# [${problem.title}](${ptaApi.getProblemURL(problem.problemSetId, problem.id, problem.type)})`)}
            </div>
            <div class="problem-set-name">
            <a href="${ptaApi.getProblemSetURL(problem.problemSetId)}" target="_blank">${problem.problemSetName}</a>
            </div>
        </div>

        <div class="banner">
            <div class="ques-info">
            <div class="detail">分数 ${problem.score} &nbsp; 提交人数 ${problem.submitCount} &nbsp; 通过人数 ${problem.acceptCount} &nbsp; 通过率 ${problem.submitCount === 0 ? 0 : (problem.acceptCount / problem.submitCount * 100).toFixed(2)}%</div>
            <div class="department">作者 ${problem.author} &nbsp;&nbsp;&nbsp; 单位 ${problem.organization}</div>
            </div>
            <hr class="banner-line"></hr>
        </div>

        <div class="content-container">
            ${markdownEngine.render(this.formatMarkdown(problem.content))}


            ${problem.problemNote ? `
                <h3>我的笔记</h3>
                <div class="pta-note">
                    ${markdownEngine.render(problem.problemNote)}
                </div>
            ` : ""}

            ${performanceHtml ? `
                <details class="performance-details" open>
                    <summary><strong>性能指标要求</strong></summary>
                    <div class="performance-content">
                        ${performanceHtml}
                    </div>
                </details>
            ` : ""}

            ${markdownEngine.render([
            "搜索一下: " + [
                `[谷歌](https://www.google.com/search?q=${keyword})`,
                `[必应](https://cn.bing.com/search?q=${keyword})`,
                `[百度](https://www.baidu.com/s?wd=${keyword})`,
                `[参考代码(仅部分题目)](https://github.com/jinzcdev/PTA/tree/main/${this.formatProblemSetName(problem.problemSetName)})`
            ].join(" | "),
            "<hr>"
        ].join("\n"))}

            ${problem.lastProgram.trim().length ?
                markdownEngine.render([
                    `### 最后一次提交 ${problem.lastSubmittedLang.trim().length ? "(" + problem.lastSubmittedLang + ")" : ""}`,
                    "```" + problem.lastSubmittedLang,
                    problem.lastProgram.replace(/```/g, '\\```'),
                    "```"
                ].join("\n")) : ""}
        </div>

        <div class="button-container">
            <button id="btnCheckLastSubmission">查看上次提交</button>
            <button id="btnSolve" title="⌘/Ctrl+Enter">开始编程</button>
            <div class="right-buttons">
                <button id="btnMoreActions" class="more-actions-trigger">
                    <span class="more-actions-icon">⋯</span>
                </button>
                <div class="more-actions-menu">
                    <button id="btnCopyProblemContent">复制题目原文</button>
                    <button id="btnUpdate">刷新题目</button>
                    <button id="btnOpenGuide">查看插件使用指南</button>
                </div>
            </div>
        </div>
        <script nonce="${getNonce()}" src="${copyButtonScriptUri}"></script>`;
    }

    private generatePerformanceHtml(problemConfig: IProblemConfig | undefined): string {
        if (!problemConfig) return '';

        const { codeSizeLimit = -1, timeLimit = -1, memoryLimit = -1, stackSizeLimit = -1, customizeLimits = [] } = problemConfig;
        let result = '';

        const limitTypesInCustomLimits = new Set<string>();

        customizeLimits.forEach(limit => {
            Object.entries(limit).forEach(([key, value]) => {
                if (value !== undefined && key.endsWith('Limit')) {
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

        generateLimitIfNeeded('codeSizeLimit', '代码长度限制', codeSizeLimit, 'KB');
        generateLimitIfNeeded('timeLimit', '时间限制', timeLimit, 'ms');
        generateLimitIfNeeded('memoryLimit', '内存限制', memoryLimit / 1024, 'MB');
        generateLimitIfNeeded('stackSizeLimit', '栈限制', stackSizeLimit, 'KB');

        if (customizeLimits.length > 0) {

            // 添加每个自定义编译器的限制
            customizeLimits.forEach(limit => {
                const compiler = limit.compiler;
                const compilerName = compilerLangMapping.get(compiler) || compiler;

                result += `<div class="performance-compiler">${compilerName}</div>`;

                const generateCustomLimitIfNeeded = (key: string, label: string, value: number | undefined, unit: string) => {
                    if (value !== undefined && value !== -1) {
                        result += this.generateLimitHtml(label, `${value} ${unit}`);
                    }
                };

                generateCustomLimitIfNeeded('timeLimit', '时间限制', limit.timeLimit, 'ms');
                generateCustomLimitIfNeeded('memoryLimit', '内存限制', limit.memoryLimit / 1024, 'MB');
                generateCustomLimitIfNeeded('stackSizeLimit', '栈限制', limit.stackSizeLimit, 'KB');
                generateCustomLimitIfNeeded('codeSizeLimit', '代码长度限制', limit.codeSizeLimit, 'KB');
            });

            // 添加默认/其他编译器的限制
            const hasDefaultLimits = ['timeLimit', 'memoryLimit', 'stackSizeLimit', 'codeSizeLimit'].some(key =>
                limitTypesInCustomLimits.has(key) && problemConfig[key as keyof IProblemConfig] !== -1
            );

            if (hasDefaultLimits) {
                result += `<div class="performance-compiler">其他编译器</div>`;

                generateLimitIfNeeded('timeLimit', '时间限制', timeLimit, 'ms');
                generateLimitIfNeeded('memoryLimit', '内存限制', memoryLimit / 1024, 'MB');
                generateLimitIfNeeded('stackSizeLimit', '栈限制', stackSizeLimit, 'KB');
                generateLimitIfNeeded('codeSizeLimit', '代码长度限制', codeSizeLimit, 'KB');
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
                    await vscode.commands.executeCommand("pintia.previewProblem", this.data.ptaCode.psID, this.data.ptaCode.pID, false);
                } else if (msg.value === "pintia.checkLastSubmission") {
                    await vscode.commands.executeCommand("pintia.checkLastSubmission", this.data.ptaCode);
                } else if (msg.value === "pintia.copyContent") {
                    const content = this.data.problem.content;
                    vscode.env.clipboard.writeText(content).then(() => {
                        vscode.window.showInformationMessage(vscode.l10n.t('Successfully copied to the clipboard!'));
                    });
                } else if (msg.value === "pintia.openGuide") {
                    await vscode.commands.executeCommand("pintia.welcome");
                }
                break;
            case "text":
                vscode.window.showInformationMessage(vscode.l10n.t(msg.value));
                break;
            default:
                await super.onDidReceiveMessage(msg);
        }
    }

    private formatProblemSetName(name: string): string {
        name = name.replace(/\uFF08|\uFF09/g, match => match === '\uFF08' ? "(" : ")") // "（）" -> "\uFF08\uFF09"
            .replace(/[\u3000-\u303F\s\-\uFF1A\u300A\u300B\u2014\u3001]/g, "_") // "《》—、：" -> "\uFF1A\u300A\u300B\u2014\u3001"
            .replace(/^_+|_+$/g, "")
            .replace(/_+/g, "_");
        return name;
    }

}