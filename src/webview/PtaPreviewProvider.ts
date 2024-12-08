import * as vscode from "vscode";
import { ptaConfig } from '../ptaConfig';
import { imgUrlPrefix, langCompilerMapping, ProblemType } from '../shared';
import { ptaApi } from "../utils/api";
import { PtaWebviewWithCodeStyle } from "./PtaWebviewWithCodeStyle";
import * as markdownEngine from './markdownEngine';
import { ProblemView } from "./views/ProblemView";
import { getGlobalContext } from "../extension";
import { getNonce, IWebViewMessage } from "./PtaWebview";
import { IProblemConfig } from "../entity/IProblem";

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
        const { codeSizeLimit = "Unknown", timeLimit = "Unknown", memoryLimit, stackSizeLimit = "Unknown" } = problemConfig || {};
        const performance = {
            codeSizeLimit,
            timeLimit,
            memoryLimit: memoryLimit ? memoryLimit / 1024 : "Unknown",
            stackSizeLimit
        };
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

            ${markdownEngine.render([
            "-----",
            [
                `[Google](https://www.google.com/search?q=${keyword})`,
                `[Baidu](https://www.baidu.com/s?wd=${keyword})`,
                `[Bing](https://cn.bing.com/search?q=${keyword})`,
                `[Solution](https://github.com/jinzcdev/PTA/tree/main/${this.formatProblemSetName(problem.problemSetName)})`
            ].join(" | ")
        ].join("\n"))}

            ${problem.problemNote ? `
                <h3>我的笔记</h3>
                <div class="pta-note">
                    ${markdownEngine.render(problem.problemNote)}
                </div>
            ` : ""}

            <details class="performance-details" open>
                <summary><strong>性能指标要求</strong></summary>
                <div class="performance-content">
                    <div class="performance-item"><span class="key">代码长度限制</span><span class="value">${performance.codeSizeLimit} KB</span></div>
                    <div class="performance-item"><span class="key">时间限制</span><span class="value">${performance.timeLimit} ms</span></div>
                    <div class="performance-item"><span class="key">内存限制</span><span class="value">${performance.memoryLimit} MB</span></div>
                    <div class="performance-item"><span class="key">栈限制</span><span class="value">${performance.stackSizeLimit} KB</span></div>
                </div>
            </details>

            ${problem.lastProgram.trim().length ?
                markdownEngine.render([
                    `### 最后一次提交 ${problem.lastSubmittedLang.trim().length ? "(" + problem.lastSubmittedLang + ")" : ""}`,
                    "```" + problem.lastSubmittedLang,
                    problem.lastProgram,
                    "```"
                ].join("\n")) : ""}
        </div>

        <div class="button-container">
            <button id="btnUpdate">刷新题目</button>
            <button id="btnSolve">开始编程</button>
        </div>
        <script nonce="${getNonce()}" src="${copyButtonScriptUri}"></script>
    `;
    }

    protected async onDidReceiveMessage(msg: IWebViewMessage): Promise<void> {
        switch (msg.type) {
            case "command":
                if (msg.value === "pintia.codeProblem") {
                    await vscode.commands.executeCommand("pintia.codeProblem", this.data.ptaCode);
                } else if (msg.value === "pintia.previewProblem") {
                    await vscode.commands.executeCommand("pintia.previewProblem", this.data.ptaCode.psID, this.data.ptaCode.pID);
                }
                break;
            case "text":
                vscode.window.showInformationMessage(msg.value);
                break;
            default:
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