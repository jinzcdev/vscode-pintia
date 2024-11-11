import * as vscode from "vscode";
import { ptaConfig } from '../ptaConfig';
import { IPtaCode, langCompilerMapping, ProblemType } from '../shared';
import { markdownEngine } from './markdownEngine';
import { PtaWebview } from './PtaWebview';
import { ProblemView } from "./views/ProblemView";
import { getGlobalContext } from "../extension";

class PtaPreviewProvider extends PtaWebview {

    private ptaCode?: IPtaCode;
    public async showPreview(psID: string, pID: string) {
        const problem = new ProblemView(psID, pID);
        await problem.fetch();

        const compiler: string = langCompilerMapping.get(ptaConfig.getDefaultLanguage()) ?? "GXX";
        this.ptaCode = {
            pID: problem.id,
            psID: problem.problemSetId,
            psName: problem.problemSetName,
            problemType: problem.type as ProblemType,
            compiler: compiler,
            title: problem.label + " " + problem.title
        };
        this.data = {
            title: problem.label,
            content: this.getContent(problem),
            style: this.getStyle()
        }
        this.show();
    }

    private formatMarkdown(str: string): string {
        const convertTexMath = (match: string) => require("katex").renderToString(
            match.substring(2, match.length - 2),
            { throwOnError: false }
        );
        return str
            .replace(/\${2}(.+?)\${2}/g, convertTexMath)
            .replace(/###\s(\u8F93\u5165\u6837|Sample\sIn)/g, '\n\n------\n\n### $1'); // \u8F93\u5165\u6837 -> 输入样
    }

    private getMediaPath(mediaFile: string, defaultUri: string = ""): vscode.Uri {
        const webview: vscode.Webview | undefined = this.getWebview();
        if (!webview) {
            return vscode.Uri.parse(defaultUri);
        }
        return webview.asWebviewUri(vscode.Uri.joinPath(getGlobalContext().extensionUri, 'media', mediaFile));
    }


    protected getStyle(data?: any): string {

        const katexCssPath = this.getMediaPath('katex.min.css', '');
        const highlightCssPath = this.getMediaPath('atom-one-light.css', '');

        return `
            <link rel="stylesheet" href="${katexCssPath}">
            <link rel="stylesheet" href="${highlightCssPath}">
            <style>
                .vscode-dark {
                    /* default .vscode-dark */
                    --pre-bg-color: rgba(10, 10, 10, 0.4);
                    --pre-bg-color-hover: rgba(10, 10, 10, 0.5);
                    --pre-bg-color-active: rgba(10, 10, 10, 0.4);
                    --pre-border-color: hsla(0, 0%, 0%, 0.06);
                }

                .vscode-light {
                    --pre-bg-color: rgba(231, 231, 231, 0.4);
                    --pre-border-color: rgba(10, 10, 10, 0.05);
                    --pre-bg-color-hover: rgba(231, 231, 231, 0.7);
                    --pre-bg-color-active: rgba(231, 231, 231, 0.4);
                }

                .vscode-high-contrast {
                    --pre-bg-color: rgba(255, 255, 255, 0);
                    --pre-border-color: rgb(255, 255, 255);
                    --pre-bg-color-hover: rgba(255, 255, 255, 0.2);
                    --pre-bg-color-active: rgba(255, 255, 255, 0.1);
                }
                
                .vscode-high-contrast-light {
                    --pre-bg-color: rgba(255, 255, 255, 0);
                    --pre-border-color: rgb(0, 0, 0);
                    --pre-bg-color-hover: rgba(10, 10, 10, 0.05);
                    --pre-bg-color-active: rgba(10, 10, 10, 0.02);
                }
                

                html {
                    line-height: 1.5;
                    padding: 10px 30px;
                    margin: 0;
                }
                
                h1, h2, h3, h4, h5, h6 {
                    font-family: inherit;
                    font-weight: 500;
                    line-height: 1.2;
                }

                h1 {
                    font-size: 30px;
                    margin-top: 10px;
                    margin-bottom: 0px;
                }

                h3 {
                    margin: 16px 0;
                    font-size: 20px;
                }

                hr {
                    border: 0;
                    height: 1px;
                    border-bottom: 1px solid;
                }
                
                a { color: var(--vscode-textLink-foreground); }
                a:link { text-decoration: none; }
                a:hover { color: var(--vscode-textLink-activeForeground); }
                
                p {
                    margin: 7.5px 0;
                    font-size: 16px;
                    color: inherit;
                }

                p img {
                    display: block;
                    width: 500px;
                    max-width: 80%;
                }

                ul, ol { font-size: 15px; }
                
                pre {
                    word-break: initial;
                    hyphens: none;
                    position: relative;
                    overflow: visible;
                    display: block;
                    
                    padding: 0.375rem 0.75rem;
                    background: hsl(211, 20%, 97%);
                    border: 1px solid var(--pre-border-color);
                    border-radius: 0.1875rem;
                }

                
                pre code {
                    font-family: var(--vscode-editor-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace);
                    font-size: 1.05em;
                    line-height: 1.357em;
                    border-radius: 0.1875rem;
                    color: var(--vscode-editor-foreground);
                    background-color: transparent;
                    margin: 0 0.125rem;
                    white-space: pre-wrap;

                    /* add scroll */
                    display: block;
                    overflow-x: auto;
                }
                pre { background-color: var(--pre-bg-color); }
                pre:hover { background-color: var(--pre-bg-color-hover); }

                .copy-button {
                    position: absolute;
                    right: 5px;
                    top: 5px;
                    padding: 1px 5px;
                    border-radius: 5px;
                    background-color: #ccc;
                    cursor: pointer;
                    z-index: 2;
                    display: none;
                }

                pre:hover .copy-button {
                    display: block;
                }

                .pta-note {
                    border: 1px solid var(--vscode-editor-foreground);
                    border-radius: 5px;
                    padding: 4px 16px;
                }
            </style>
            
            <style>
                #solve {
                    position: fixed;
                    bottom: 1rem;
                    right: 1rem;
                    border: 0;
                    margin: 1rem 0;
                    padding: 0.2rem 1rem;
                    color: var(--vscode-button-foreground);
                    background-color: var(--vscode-button-background);
                }
                #solve:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                #solve:active {
                    border: 0;
                }
		</style>

		<style>
            .banner .ques-info {
                /* display & justify-content*/
                display: flex;
                justify-content: space-between;
                margin-top: 8px;
                font-size: 13px;
            }
            .banner .ques-info .detail, .department { display: flex; }
            .banner-line { margin: 8px auto 10px; }
        </style>`
    }

    protected getContent(data: ProblemView): string {
        const keyword: string = `${data.label} ${data.title}`.replace(/ /g, '+');
        return `
            <div class="banner" >
                <div class="banner-header">
                    ${markdownEngine.render(`# [${data.title}](https://pintia.cn/problem-sets/${data.problemSetId}/exam/problems/${data.id})`)}
                </div>
                <div class="ques-info">
                    <div class="detail">分数 ${data.score} &nbsp; 提交人数 ${data.submitCount} &nbsp; 通过人数 ${data.acceptCount} &nbsp; 通过率 ${data.submitCount === 0 ? 0 : (data.acceptCount / data.submitCount * 100).toFixed(2)}%</div>
                    <div class="department">作者 ${data.author} &nbsp;&nbsp;&nbsp; 单位 ${data.organization}</div>
                </div>
                <hr class="banner-line"></hr>
            </div>

            ${markdownEngine.render(this.formatMarkdown(data.content))}


            ${markdownEngine.render([
            "-----",
            `[Google](https://www.google.com/search?q=${keyword})`,
            " | ",
            `[Baidu](https://www.baidu.com/s?wd=${keyword})`,
            " | ",
            `[Bing](https://cn.bing.com/search?q=${keyword})`,
            " | ",
            `[Solution](https://github.com/jinzcdev/PTA/tree/main/${this.formatProblemSetName(data.problemSetName)})`
        ].join("\n"))}

            ${data.problemNote ? `
                <h3>Problem Note</h3>
                <div class="pta-note">
                    ${markdownEngine.render(data.problemNote)}
                </div>
            ` : ""}

            ${data.lastProgram.trim().length ?
                markdownEngine.render([
                    `### Last Submission ${data.lastSubmittedLang.trim().length ? "(" + data.lastSubmittedLang + ")" : ""}`,
                    "```" + data.lastSubmittedLang,
                    data.lastProgram,
                    "```"
                ].join("\n")) : ""}

            <button id="solve">Code Now</button>

            <script>
                const vscode = acquireVsCodeApi();
                const button = document.getElementById('solve');
                button.onclick = () => {
                    vscode.postMessage({
                        type: 'command',
                        value: 'pintia.codeProblem'
                    });
                };
                
                var lst_pre = document.getElementsByTagName("pre");
                for (const pre of lst_pre) {
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.innerText = 'Copy';
                    copyButton.onclick = (event) => {
                        event.stopPropagation();
                        var content = pre.innerText;
                        navigator.clipboard.writeText(content).then(() => {
                            vscode.postMessage({
                                type: 'text',
                                value: 'Successfully copied to the clipboard!'
                            });
                        });
                    };
                    pre.appendChild(copyButton);
                }
            </script>
        `;
    }

    protected async onDidReceiveMessage(msg: IWebViewMessage): Promise<void> {
        switch (msg.type) {
            case "command":
                await vscode.commands.executeCommand(msg.value, this.ptaCode);
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

export const ptaPreviewProvider: PtaPreviewProvider = new PtaPreviewProvider();

interface IWebViewMessage {
    type: string; // 'command' or 'text'
    value: string; // the value of `type`
}