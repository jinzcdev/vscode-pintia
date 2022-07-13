import { PtaWebview } from "./PtaWebview";
import { IProblemSubmissionResult } from "../entity/ProblemSubmissionResult";
import { ProblemType, solutionStatusMapping, ptaCompiler } from "../shared";
import { IProblemSubmissionDetail } from "../entity/ProblemSubmissionCode";

class PtaSubmissionProvider extends PtaWebview {

    public async showSubmission(result: IProblemSubmissionResult) {
        const submissionDetail: IProblemSubmissionDetail = result.submission.submissionDetails[0];
        const judgeResponseContent = result.submission.judgeResponseContents[0];
        const codeJudgeResponseContent = ProblemType.PROGRAMMING ? judgeResponseContent.programmingJudgeResponseContent
            : judgeResponseContent.codeCompletionJudgeResponseContent;
        const testcaseJudgeResults = codeJudgeResponseContent!.testcaseJudgeResults;

        this.data = {
            title: "PTA: Submission",
            style: this.getStyle({ isHint: Object.keys(result.submission.hints).length > 0 }),
            content: this.getContent({
                submitAt: result.submission.submitAt,
                status: judgeResponseContent.status,
                score: judgeResponseContent.score,
                testcaseJudgeResults: testcaseJudgeResults,
                hints: result.submission.hints,
                problemType: result.submission.problemType,
                compiler: result.submission.compiler,
                time: result.submission.time,
                memory: result.submission.memory,
                compilationOutput: codeJudgeResponseContent!.compilationResult.log,
                program: result.submission.problemType === ProblemType.PROGRAMMING ?
                    submissionDetail.programmingSubmissionDetail!.program :
                    submissionDetail.codeCompletionSubmissionDetail!.program
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
                }

                h2 {
                    color: var(--vscode-foreground);
                    font-size: 18px;
                    margin: 0 auto;
                    margin-top: 35px;
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
                    border-bottom: 0.8px solid var(--border-color);
                    padding: 16px;
                }

                ${data.isHint ? "" : " .visible { display: none; } "}

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
        const compiler: any = ptaCompiler[data.compiler as keyof typeof ptaCompiler];
        let cases: string = "";
        for (const i in data.testcaseJudgeResults) {
            const element = data.testcaseJudgeResults[i];
            cases += `
            <tr>
                <td>${i}</td>
                <td class="visible">${data.hints[i]}</td>
                ${solutionStatusMapping.get(element.result)}
                <td>${element.testcaseScore}</td>
                <td>${(element.time * 1000).toFixed()}ms</td>
                <td>${element.memory / 1024}KB</td>
            </tr>
            `;
        }
        return `

        <div>
            <h2>总评</h2>
            <table>
                <thead>
                    <th>提交时间</th>
                    <th>状态</th>
                    <th>分数</th>
                    <th>题目</th>
                    <th>编译器</th>
                    <th>耗时</th>
                    <th>用户</th>
                </thead>
                <tbody>
                    <tr>
                        <td>${this.formatDate(new Date(data.submitAt))}</td>
                        ${solutionStatusMapping.get(data.status)}
                        <td>${data.score}</td>
                        <td>${data.problemType === "PROGRAMMING" ? "编程题" : "函数题"}</td>
                        <td>${compiler.language}(${compiler.displayName})</td>
                        <td>${(data.time * 1000).toFixed()}ms</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div ${data.status === "COMPILE_ERROR" ? "style='display: none;'" : ""}" >
            <h2>单点测试得分</h2>
            <table>
                <thead>
                    <tr>
                        <th>测试点</th>
                        <th class="visible">提示</th>
                        <th>结果</th>
                        <th>分数</th>
                        <th>耗时</th>
                        <th>内存</th>
                    <tr>
                </thead>
                <tbody>
                    ${cases}
                </tbody>
            </table>
        </div>

        <h2>编译器输出</h2>
        <div class="code-preview">
            <pre><code>${data.compilationOutput}</code></pre>
        </div>
        `
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear(),
            month = date.getMonth(),
            day = date.getDate(),
            hour = date.getHours(),
            minute = date.getMinutes(),
            second = date.getSeconds();
        const f = (e: number) => e < 10 ? '0' + e : e;
        return `${year}/${month}/${day} ${f(hour)}:${f(minute)}:${f(second)}`;
    }
}

export const ptaSubmissionProvider: PtaSubmissionProvider = new PtaSubmissionProvider()