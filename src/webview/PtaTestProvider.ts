import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaWebview } from "./PtaWebview";
import { TestView } from "./views/TestView";

export class PtaTestProvider extends PtaWebview<TestView> {

    private static instance: PtaTestProvider | null = null;

    public static createOrUpdate(view: TestView): PtaTestProvider {
        if (!PtaTestProvider.instance) {
            PtaTestProvider.instance = new PtaTestProvider(view);
        }
        PtaTestProvider.instance.updateView(view);
        return PtaTestProvider.instance;
    }

    protected async loadViewData(testView: TestView): Promise<void> {
        const result = testView.result;
        const answer = testView.answer;

        try {
            const judgeResponseContent = result.submission.judgeResponseContents[0];
            const codeJudgeResponseContent = judgeResponseContent.programmingJudgeResponseContent
                ?? judgeResponseContent.codeCompletionJudgeResponseContent;
            const testcaseJudgeResults = codeJudgeResponseContent!.testcaseJudgeResults;

            this.data = {
                title: "Test",
                testResult: {
                    testCase: result.submission.submissionDetails[0].customTestData?.content,
                    answer: answer ?? "",
                    myAnswer: judgeResponseContent.status === "COMPILE_ERROR" ? "COMPILE_ERROR" : testcaseJudgeResults?.custom.stdout ?? "",
                    problemType: result.submission.problemType,
                    compiler: result.submission.compiler,
                    time: result.submission.time,
                    memory: result.submission.memory,
                    compilationOutput: codeJudgeResponseContent!.compilationResult.log
                }
            };
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            promptForOpenOutputChannel("Failed to test!", DialogType.error);
        }
    }

    protected getStyle(): string {
        return `
            <style>
                :root {
                    --border-color: rgba(121, 121, 121, 0.12);
                }

                .vscode-light {
                    --border-color: hsla(0, 0%, 0%, 0.06);
                }

                html {
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
                    overflow: auto;
                    font-size: 15px;
                    max-height: 250px;
                }

                pre, code {
                    margin: 0;
                    padding: 0;
                }

                code {
                    color: var(--vscode-editor-color);
                    display: block;
                    background-color: transparent;
                    font-family: var(--vscode-editor-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace);
                }
            </style>`;
    }

    protected getContent(): string {
        const testResult = this.data.testResult;
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
                        <td><pre><code>${testResult.testCase}</pre></code></td>
                        <td><pre><code>${testResult.myAnswer}</pre></code></td>
                        <td><pre><code>${testResult.answer}</pre></code></td>
                    </tr>
                </tbody>
            </table>

            <h2>编译器输出</h2>
            <div class="code-preview">
                <pre><code>${testResult.compilationOutput}</code></pre>
            </div>
        `;
    }

}