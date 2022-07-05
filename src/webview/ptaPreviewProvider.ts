
import * as vscode from 'vscode';
import { IProblem } from '../entity/Problem';
import { IProblemInfo } from '../entity/ProblemInfo';
import { PtaNode } from '../explorer/PtaNode';
import { ptaApi } from '../utils/api';
import { markdown } from './markdownEngine';
import { PtaWebview } from './PtaWebview';

class PtaPreviewProvider extends PtaWebview {

    public async showPreview(node: PtaNode) {
        const problem: IProblem = await ptaApi.getProblem(node.psID, node.pID);
        const problemInfo = node.value.problemInfo;
        this.data = {
            title: problem.title,
            content: this.getContent(Object.assign({}, problemInfo, {
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
            .replace("### 输入样", "\n\n<hr style='margin: 10px 0 0;'>\n\n### 输入样")
            .replace("### Sample In", "\n\n<hr style='margin: 10px 0 0;'>\n\n### Sample In");
    }


    protected getStyle(data?: any): string {
        return `
     <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">

            <style>
                html {
                    line-height: 1.15;
                    padding: 10px 30px;
                }
                div.code {
                    color: hsl(0, 0%, 25%);
                }
                
                h1, h2, h3, h4, h5, h6 {
                    margin-top: 0;
                    margin-bottom: 0;
                    
                    font-family: inherit;
                    font-weight: 500;
                    line-height: 1.2;
                    color: inherit;
                }

                h1 {
                    padding-bottom: 0.3em;
                    line-height: 1.2;
                    border-bottom-width: 1px;
                    border-bottom-style: solid;
                    font-weight: normal;
                    margin-bottom: 20px;
                }
                
                a {
                    color: var(--vscode-textLink-foreground);
                }
                
                a:link {
                    text-decoration: none;
                }
                
                a:hover {
                    color: var(--vscode-textLink-activeForeground);
                }
                
                a:focus {
                    outline: 1px solid -webkit-focus-ring-color;
                    outline-offset: -1px;
                }
                
                h3 {
                    margin: 16px 0;
                    font-size: 20px;
                }
                
                p {
                    margin: 7.5px 0;
                    font-size: 16px;
                    color: inherit;
                }

                ul, ol {
                    font-size: 15px;
                }
                
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

                .vscode-dark pre {
                    background-color: rgba(10, 10, 10, 0.4);
                }

                .vscode-dark h1, .vscode-dark hr, .vscode-dark td {
                    border-color: rgba(255, 255, 255, 0.18);
                }
                
                code {
                    color: var(--vscode-textPreformat-foreground);
                }
                
                pre code {
                    
                    font-family: var(--vscode-editor-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace);
                    font-size: 1em;
                    line-height: 1.357em;

                    border-radius: 0.1875rem;
                    bo  rder: 1px solid var(--border-all);
                    color: var(--vscode-editor-foreground);
                    margin: 0 0.125rem;
                    white-space: pre-wrap;

                    /* 超出的文本可以在pre内滑动 */
                    display: block;
                    overflow-x: auto;
                }

                hr {
                    border: 0;
                    height: 1px;
                    border-bottom: 1px solid;
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
            .banner {
                width: auto;
            }

            .banner .banner-header {
                display: table;
            }

            .banner-header a {
                font-size: 30px;
                display: table-cell;
            }

            .banner-header .ques-score {
                display: inline-block;
                font-size: 4px;
                border: 1px solid;
                border-radius: 9999px;
                padding: 1px 2px;
            }

            .banner .ques-info {
                /* display & justify-content*/
                display: flex;
                justify-content: space-between;

                margin-top: 8px;
                font-size: 13px;

                /* useless */
                align-items: flex-end;
            }

            .banner .ques-info .detail {
                display: flex;
            }

            .banner .ques-info .department {
                display: flex;
            }

            .banner-line {
                height: 0.5px;
                margin-top: 8px;
                margin-bottom: 10px;
                /*
                background-color: var(--vscode-editor-foreground);
                border: 0;
                height: 1px;
                border-bottom: 1px solid;
                */
            }
        </style>`
    }

    protected getContent(data?: any): string {
        console.log(data);
        // console.log(this.fotmatMarkdown(data.content));
        // console.log(markdown.render(this.fotmatMarkdown(data.content)));
        return `         
            <div class="banner" >
                <div class="banner-header">
                    ${markdown.render(`[${data.title}](https://pintia.cn/problem-sets/${data.problemSetId}/problems/${data.id})`)}
                </div>
                <div class="ques-info">
                    <div class="detail">分数 ${data.score} &nbsp; 提交人数 ${data.submitCount} &nbsp; 通过人数 ${data.acceptCount} &nbsp; 通过率 ${data.submitCount === 0 ? 0 : (data.acceptCount / data.submitCount * 100).toFixed(2)}%</div>
                    <div class="department">作者 ${data.author} &nbsp;&nbsp;&nbsp; 单位 ${data.organization}</div>
                </div>
                <hr class="banner-line"></hr>
            </div>

            ${markdown.render(this.fotmatMarkdown(data.content))}

            <button id="solve">Code Now</button>

            <script>
                const vscode = acquireVsCodeApi();
                const button = document.getElementById('solve');
                button.onclick = () => {
                    vscode.postMessage({
                        command: 'ShowProblem',
                    });
                };
            </script>
        `;
    }

    // ${md.render(`# [${data.title}](https://pintia.cn/problem-sets/${data.problemSetId}/problems/${data.id})\n` + parse(data.content))}

}



// if (node.psID === "91827364500") {


export const ptaPreviewProvider: PtaPreviewProvider = new PtaPreviewProvider();



// import MarkdownIt = require('markdown-it');


// import QRCode = require('qrcode')

// import QRCode from 'qrcode'
// let graphics = await QRCode.toString('somedata', {type: 'svg', margin: 0})   