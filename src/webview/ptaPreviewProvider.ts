
import * as vscode from "vscode";
import { IProblem } from '../entity/Problem';
import { IProblemInfo } from '../entity/ProblemInfo';
import { PtaNode } from '../explorer/PtaNode';
import { ptaConfig } from '../ptaConfig';
import { IPtaCode, langCompilerMapping } from '../shared';
import { ptaApi } from '../utils/api';
import { markdownEngine } from './markdownEngine';
import { PtaWebview } from './PtaWebview';

class PtaPreviewProvider extends PtaWebview {

    private ptaCode?: IPtaCode;
    public async showPreview(node: PtaNode) {
        const problem: IProblem = await ptaApi.getProblem(node.psID, node.pID);
        const problemInfo: IProblemInfo = node.value.problemInfo!;
        const compiler: string = langCompilerMapping.get(ptaConfig.getDefaultLanguage()) ?? "GXX";
        this.ptaCode = { psID: problem.problemSetId, psName: node.value.problemSet, pID: problem.id, problemType: node.value.problemType, compiler: compiler, title: problem.label + " " + problem.title };
        this.data = {
            title: problem.label,
            content: this.getContent(Object.assign({}, problemInfo, {
                label: problem.label,
                title: problem.title,
                author: problem.author,
                organization: problem.authorOrganization.name,
                content: problem.content
            })),
            style: this.getStyle()
        }
        this.show();
    }

    private fotmatMarkdown(str: string): string {
        return str.replace(/\$\$/g, "$")
            .replace(/\$\\/g, "$")
            .replace("### 输入样", "\n\n<hr style='margin: 10px 0 0;'>\n\n### 输入样")
            .replace("### Sample In", "\n\n<hr style='margin: 10px 0 0;'>\n\n### Sample In");
    }


    protected getStyle(data?: any): string {
        return `
     <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">

            <style>
                :root {
                    /* default .vscode-dark */
                    --pre-bg-color: rgba(10, 10, 10, 0.4);
                    --pre-bg-color-hover: rgba(10, 10, 10, 0.5);
                    --pre-bg-color-active: rgba(10, 10, 10, 0.4);
                    --border-color: rgba(255, 255, 255, 0.18);
                }

                .vscode-light {
                    --pre-bg-color: rgba(231, 231, 231, 0.4);
                    --pre-bg-color-hover: rgba(231, 231, 231, 0.7);
                    --pre-bg-color-active: rgba(231, 231, 231, 0.4);
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

                ul, ol { font-size: 15px; }
                
                pre {
                    word-break: initial;
                    hyphens: none;
                    position: relative;
                    overflow: visible;
                    display: block;
                    
                    padding: 0.375rem 0.75rem;
                    background: hsl(211, 20%, 97%);
                    border: 1px solid hsla(0, 0%, 0%, 0.06);
                    border-radius: 0.1875rem;
                }

                
                code { color: var(--vscode-textPreformat-foreground); }
                pre code {
                    font-family: var(--vscode-editor-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace);
                    font-size: 1.05em;
                    line-height: 1.357em;
                    border-radius: 0.1875rem;
                    color: var(--vscode-editor-foreground);
                    margin: 0 0.125rem;
                    white-space: pre-wrap;

                    /* add scroll */
                    display: block;
                    overflow-x: auto;
                }
                pre { background-color: var(--pre-bg-color); }
                pre:hover { background-color: var(--pre-bg-color-hover); }
                pre:active { background-color: var(--pre-bg-color-active); }
                pre:hover:after {
                    position: absolute;
                    right: 5px;
                    top: 5px;
                    padding: 1px;
                    border-radius: 5px;
                    content: "Click to Copy";
                    z-index: 2;
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
                    color: white;
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

    protected getContent(data?: any): string {
        return `
            <div class="banner" >
                <div class="banner-header">
                    ${markdownEngine.render(`# [${data.title}](https://pintia.cn/problem-sets/${data.problemSetId}/problems/${data.id})`)}
                </div>
                <div class="ques-info">
                    <div class="detail">分数 ${data.score} &nbsp; 提交人数 ${data.submitCount} &nbsp; 通过人数 ${data.acceptCount} &nbsp; 通过率 ${data.submitCount === 0 ? 0 : (data.acceptCount / data.submitCount * 100).toFixed(2)}%</div>
                    <div class="department">作者 ${data.author} &nbsp;&nbsp;&nbsp; 单位 ${data.organization}</div>
                </div>
                <hr class="banner-line"></hr>
            </div>

            ${markdownEngine.render(this.fotmatMarkdown(data.content)).replace(/<pre>/g, "<pre onclick='copyCode(this)'>")}

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

                function copyCode(event) {
                    var content = event.innerText;
                    navigator.clipboard.writeText(content).then(() => {
                        vscode.postMessage({
                            type: 'text',
                            value: 'Successfully copied to the clipboard!'
                        });
                    });
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
}

export const ptaPreviewProvider: PtaPreviewProvider = new PtaPreviewProvider();

interface IWebViewMessage {
    type: string; // 'command' or 'text'
    value: string; // the value of `type`
}