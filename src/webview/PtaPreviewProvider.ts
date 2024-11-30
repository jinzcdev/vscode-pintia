import * as vscode from "vscode";
import { ptaConfig } from '../ptaConfig';
import { imgUrlPrefix, langCompilerMapping, ProblemType } from '../shared';
import { ptaApi } from "../utils/api";
import { PtaWebviewWithCodeStyle } from "./PtaWebviewWithCodeStyle";
import { markdownEngine } from './markdownEngine';
import { ProblemView } from "./views/ProblemView";
import { getGlobalContext } from "../extension";
import { getNonce, IWebViewMessage } from "./PtaWebview";

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
        const compiler: string = langCompilerMapping.get(ptaConfig.getDefaultLanguage()) ?? "GXX";
        await problem.fetch();
        this.data = {
            title: `${problem.label} ${problem.title}`,
            ptaCode: {
                pID: problem.id,
                psID: problem.problemSetId,
                psName: problem.problemSetName,
                problemType: problem.type as ProblemType,
                compiler: compiler,
                title: `${problem.label} ${problem.title}`
            },
            problem: problem
        };
    }

    private formatMarkdown(str: string): string {
        const convertTexMath = (match: string) => require("katex").renderToString(
            match.substring(2, match.length - 2),
            { throwOnError: false }
        );

        const convertImageSyntax = (match: string, alt: string, link: string) => {
            link = link.trim();
            if (link.startsWith("http")) {
                return `<img alt="${alt}" src="${link}">`;
            }
            let i = link.length - 1;
            while (i >= 0 && link[i] !== "/") i--;
            return `<img alt="${alt}" src="${imgUrlPrefix}/${link.substring(i + 1)}">`;
        };

        return str
            .replace(/\${2}(.+?)\${2}/g, convertTexMath)
            .replace(/###\s(\u8F93\u5165\u6837|Sample\sIn)/g, '\n\n------\n\n### $1') // \u8F93\u5165\u6837 -> 输入样例
            .replace(/!\[([^\]]*)\]\((.*?)\)/g, convertImageSyntax);
    }

    protected getContent(): string {
        const problem = this.data.problem as ProblemView;
        const keyword: string = `${problem.label} ${problem.title}`.replace(/ /g, '+');
        const copyButtonScriptUri = this.getWebview()?.asWebviewUri(vscode.Uri.joinPath(getGlobalContext().extensionUri, "media", "main.js"));
        return `
            <div class="banner" >
                <div class="banner-header">
                    ${markdownEngine.render(`# [${problem.title}](${ptaApi.getProblemURL(problem.problemSetId, problem.id, problem.type)})`)}
                </div>
                <div class="ques-info">
                    <div class="detail">分数 ${problem.score} &nbsp; 提交人数 ${problem.submitCount} &nbsp; 通过人数 ${problem.acceptCount} &nbsp; 通过率 ${problem.submitCount === 0 ? 0 : (problem.acceptCount / problem.submitCount * 100).toFixed(2)}%</div>
                    <div class="department">作者 ${problem.author} &nbsp;&nbsp;&nbsp; 单位 ${problem.organization}</div>
                </div>
                <hr class="banner-line"></hr>
            </div>

            ${markdownEngine.render(this.formatMarkdown(problem.content))}


            ${markdownEngine.render([
            "-----",
            `[Google](https://www.google.com/search?q=${keyword})`,
            " | ",
            `[Baidu](https://www.baidu.com/s?wd=${keyword})`,
            " | ",
            `[Bing](https://cn.bing.com/search?q=${keyword})`,
            " | ",
            `[Solution](https://github.com/jinzcdev/PTA/tree/main/${this.formatProblemSetName(problem.problemSetName)})`
        ].join("\n"))}

            ${problem.problemNote ? `
                <h3>我的笔记</h3>
                <div class="pta-note">
                    ${markdownEngine.render(problem.problemNote)}
                </div>
            ` : ""}

            ${problem.lastProgram.trim().length ?
                markdownEngine.render([
                    `### 最后一次提交 ${problem.lastSubmittedLang.trim().length ? "(" + problem.lastSubmittedLang + ")" : ""}`,
                    "```" + problem.lastSubmittedLang,
                    problem.lastProgram,
                    "```"
                ].join("\n")) : ""}

            <button id="solve">Code Now</button>
            <script nonce="${getNonce()}" src="${copyButtonScriptUri}"></script>
        `;
    }

    protected async onDidReceiveMessage(msg: IWebViewMessage): Promise<void> {
        switch (msg.type) {
            case "command":
                await vscode.commands.executeCommand(msg.value, this.data.ptaCode);
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