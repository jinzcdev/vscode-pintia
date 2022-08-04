import { IProblemSubmissionResult } from "../entity/IProblemSubmissionResult";
import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaWebview } from "./PtaWebview";


class PtaTestProvider extends PtaWebview {

    public async showTestResult(result: IProblemSubmissionResult, answer?: string) {
        try {
            const judgeResponseContent = result.submission.judgeResponseContents[0];
            const codeJudgeResponseContent = judgeResponseContent.programmingJudgeResponseContent
                ?? judgeResponseContent.codeCompletionJudgeResponseContent;
            const testcaseJudgeResults = codeJudgeResponseContent!.testcaseJudgeResults;

            this.data = {
                title: "Test",
                style: this.getStyle(),
                content: this.getContent({
                    testCase: result.submission.submissionDetails[0].customTestData?.content,
                    answer: answer ? answer : "",
                    myanswer: judgeResponseContent.status === "COMPILE_ERROR" ? "COMPILE_ERROR" : testcaseJudgeResults?.custom.stdout ?? "",
                    problemType: result.submission.problemType,
                    compiler: result.submission.compiler,
                    time: result.submission.time,
                    memory: result.submission.memory,
                    compilationOutput: codeJudgeResponseContent!.compilationResult.log
                })
            };

            this.show()
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            await promptForOpenOutputChannel("Failed to test!", DialogType.error);
        }
    }

    protected getStyle(data?: any): string {
        return `
            <style>
                :root {
                    --border-color: rgba(121, 121, 121, 0.12);
                }

                .vscode-light {
                    --border-color: hsla(0, 0%, 0%, 0.06);
                }

                html {
                    font-family: 'Harmony', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                    width: 90%;
                    margin: 0 auto;
                    font-size: 15px;
                    line-height: 1.5;
                }

                h2 {
                    color: var(--vscode-foreground);
                    font-size: 18px;
                    margin: 0 auto;
                    margin-top: 35px;
                    margin-bottom: 10px;
                }

                table {
                    width: 75%;
                    margin: 0 auto;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 15px;
                }

                thead {
                    font-size: 15px;
                }

                th, td {
                    padding: 16px;
                    border-bottom: 0.8px solid var(--border-color)
                }

                .code-preview {
                    width: 100%;
                    border: 0.5px solid var(--border-color);
                    margin-top: 15px;
                    padding: 12px;
                    font-size: 16px;
                }

                pre, code {
                    margin: 0;
                    padding: 0;
                }

                code {
                    color: var(--vscode-editor-color)
                    max-height: 250px;
                    overflow: scroll;
                    display: block;
                }
            </style>`;
    }

    protected getContent(data?: any): string {
        return `
            <h2>测试结果</h2>

            <table>
                <thead>
                    <th>测试用例</th>
                    <th>运行结果</th>
                    <th>预期结果</th>
                </thead>
                <tbody>
                    <tr>
                        <td><pre><code>${data.testCase}</pre></code></td>
                        <td><pre><code>${data.myanswer}</pre></code></td>
                        <td><pre><code>${data.answer}</pre></code></td>
                    </tr>
                </tbody>
            </table>

            <h2>编译器输出</h2>
            <div class="code-preview">
                <pre><code>${data.compilationOutput}</code></pre>
            </div>
        `;
    }

}

export const ptaTestProvider: PtaTestProvider = new PtaTestProvider();