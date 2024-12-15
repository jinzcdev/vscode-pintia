import { l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { ptaApi } from "../utils/api";
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
                title: `测试结果 | ${result.problem?.title ?? "Unknown"}`,
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
            promptForOpenOutputChannel(l10n.t("Failed to test!"), DialogType.error);
        }
    }

    protected getStyle(): string {
        return `
            <style>
                :root {
                    --border-color: var(--vscode-editorWidget-border);
                    --primary-font: var(--vscode-font-family);
                    --secondary-font: var(--vscode-editor-font-family);
                    --background-color: var(--vscode-editor-background);
                    --foreground-color: var(--vscode-editor-foreground);
                    --border-radius: 8px;
                    --box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    --secondary-color: var(--vscode-button-secondaryBackground);
                    --table-header-bg: var(--vscode-editorGroupHeader-tabsBackground);
                    --table-header-color: var(--vscode-editor-foreground)
                }

                .test-container {
                    padding: 1rem;
                    background-color: var(--background-color);
                    border-radius: var(--border-radius);
                    box-shadow: var(--box-shadow);
                    margin: 0.2rem auto;
                    max-width: 90vh;
                }

                html,
                body {
                    height: 100%;
                    margin: 0;
                    line-height: 1.5;
                    font-family: var(--primary-font);
                    color: var(--foreground-color);
                    background-color: var(--background-color);
                }

                h2 {
                    font-size: 1.5rem;
                    margin: 1.5rem 0;
                    text-align: left;
                    padding-bottom: 0.5rem;
                }

                table {
                    width: 100%;
                    margin: 20px 0;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.875rem;
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    overflow: hidden;
                }

                thead {
                    background-color: var(--table-header-bg);
                    color: var(--table-header-color);
                }

                th,
                td {
                    padding: 1rem;
                    border: 1px solid var(--border-color);
                    word-wrap: break-word;
                    white-space: normal;
                }

                th {
                    background-color: var(--table-header-bg);
                    color: var(--table-header-color);
                    font-weight: bold;
                }

                .code-preview {
                    width: 100%;
                    border: 1px solid var(--border-color);
                    margin-top: 20px;
                    padding: 1rem;
                    overflow: auto;
                    font-size: 0.875rem;
                    max-height: 50vh;
                    background-color: var(--vscode-editorWidget-background);
                    border-radius: var(--border-radius);
                    box-sizing: border-box;
                }

                pre,
                code {
                    margin: 0;
                    padding: 0;
                }

                code {
                    color: var(--foreground-color);
                    display: block;
                    background-color: transparent;
                    font-family: var(--secondary-font);
                }

                .test-container code {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
            </style>`;
    }

    protected getContent(): string {
        const testResult = this.data.testResult;
        return `
            <div class="test-container">
                <h2>测试结果</h2>
    
                <table>
                    <thead>
                        <tr>
                            <th>测试用例</th>
                            <th>运行结果</th>
                            <th>预期结果</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><pre><code>${testResult.testCase}</code></pre></td>
                            <td><pre><code>${testResult.myAnswer}</code></pre></td>
                            <td><pre><code>${testResult.answer}</code></pre></td>
                        </tr>
                    </tbody>
                </table>
    
                <h2>编译器输出</h2>
                <div class="code-preview">
                    <pre><code>${testResult.compilationOutput}</code></pre>
                </div>
            </div>
        `;
    }

}