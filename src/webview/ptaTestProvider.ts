import { PtaWebview } from "./PtaWebview";
import { IProblemSubmissionResult } from "../entity/ProblemSubmissionResult";
import { ProblemType, solutionStatusMapping, ptaCompiler } from "../shared";
import { IProblemSubmissionDetail } from "../entity/ProblemSubmissionCode";
import { markdown } from "./markdownEngine";

class PtaTestProvider extends PtaWebview {

    public async showTestResult(result: IProblemSubmissionResult, answer?: string) {
        const judgeResponseContent = result.submission.judgeResponseContents[0];
        const codeJudgeResponseContent = ProblemType.PROGRAMMING ? judgeResponseContent.programmingJudgeResponseContent
            : judgeResponseContent.codeCompletionJudgeResponseContent;
        const testcaseJudgeResults = codeJudgeResponseContent!.testcaseJudgeResults;

        this.data = {
            title: "PTA: Test",
            style: this.getStyle(),
            content: this.getContent({
                testCase: result.submission.submissionDetails[0].customTestData?.content,
                answer: answer ? answer : "",
                myanswer: testcaseJudgeResults.custom.stdout,
                problemType: result.submission.problemType,
                compiler: result.submission.compiler,
                time: result.submission.time,
                memory: result.submission.memory,
                compilationOutput: codeJudgeResponseContent!.compilationResult.log
            })
        };

        this.show()
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
                }

                h2 {
                    color: var(--vscode-foreground);
                    font-size: 18px;
                    margin: 0 auto;
                    margin-top: 35px;
                    margin-bottom: 10px;
                }

                table {
                    width: 95%;
                    margin: 0 auto;
                    border-collapse: collapse;
                    text-align: center;
                    font-size: 14px;
                }

                thead {
                    font-size: 15px;
                }

                th, td {
                    padding: 16px;
                    border-bottom: 0.8px solid var(--border-color)
                }

            </style>`;
    }

    protected getContent(data?: any): string {
        return `
            <h2>测试结果</h2>
            ${markdown.render([
                `| 测试用例 | 运行结果 | 预期结果 |`,
                `| :-: | :-: | :-: |`,
                `| ${data.testCase.replaceAll(/\n/g, "<br>")} | ${data.answer.replaceAll(/\n/g, "<br>")} | ${data.myanswer.replaceAll(/\n/g, "<br>")} |`
            ].join("\n"))}
        `;
    }

}

export const ptaTestProvider: PtaTestProvider = new PtaTestProvider();