import { IProblem, IProblemConfig } from "../entity/IProblem";
import { IProblemSubmissionResult } from "../entity/IProblemSubmissionResult";
import { IProblemSubmissionDetail } from "../entity/problemSubmissionCode";
import { ProblemType, problemTypeInfoMapping, ptaCompiler, solutionStatusMapping } from "../shared";
import { ptaApi } from "../utils/api";
import { markdownEngine } from "./markdownEngine";
import { PtaWebview } from "./PtaWebview";

export class PtaSubmissionProvider extends PtaWebview<IProblemSubmissionResult> {

    private static instance: PtaSubmissionProvider | null = null;

    public static createOrUpdate(view: IProblemSubmissionResult): PtaSubmissionProvider {
        if (!PtaSubmissionProvider.instance) {
            PtaSubmissionProvider.instance = new PtaSubmissionProvider(view);
        }
        PtaSubmissionProvider.instance.updateView(view);
        return PtaSubmissionProvider.instance;
    }

    protected async loadViewData(result: IProblemSubmissionResult): Promise<void> {
        const submissionDetail: IProblemSubmissionDetail = result.submission.submissionDetails[0];
        const judgeResponseContent = result.submission.judgeResponseContents[0];
        const codeJudgeResponseContent = judgeResponseContent.programmingJudgeResponseContent ??
            judgeResponseContent.codeCompletionJudgeResponseContent;
        const testcaseJudgeResults = codeJudgeResponseContent!.testcaseJudgeResults;

        const psID = result.submission.problemSetId, pID = result.submission.problemSetProblemId;
        const problem: IProblem = await ptaApi.getProblem(psID, pID);

        const prefix: string = problemTypeInfoMapping.get(result.submission.problemType)?.prefix ?? "";
        const problemConfig: IProblemConfig = problem.problemConfig[`${prefix}ProblemConfig` as keyof typeof problem.problemConfig] as IProblemConfig;
        const testCases = problemConfig && typeof problemConfig === 'object' ? problemConfig.cases : [];

        const hints = result.submission.hints;
        const isHint: boolean = Object.values(hints).some((hint: any) => typeof hint === "string" && hint.trim().length > 0);
        this.data = {
            title: `提交结果 | ${problem.title}`,
            isHint: isHint,
            content: {
                totalScore: problem.score,
                timeLimit: problemConfig.timeLimit,
                memoryLimit: problemConfig.memoryLimit,
                nickname: result.examMember.user.nickname,
                submitAt: result.submission.submitAt,
                status: judgeResponseContent.status,
                score: judgeResponseContent.score,
                testCases: testCases,
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
            }
        };
    }

    protected getStyle(): string {
        return `
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/atom-one-light.min.css">
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
                    margin: 0 auto 35px;
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

                ${this.data.isHint ? "" : " .visible { display: none; } "}

                .code-block {
                    border: 0.5px solid var(--border-color);
                    margin-top: 15px;
                    padding: 12px;
                    font-size: 14px;
                }

                pre, code {
                    margin: 0;
                    padding: 0;
                }

                code {
                    font-family: var(--vscode-editor-font-family);
                    color: var(--vscode-editor-color);
                    overflow: scroll;
                    display: block;
                    background-color: transparent;
                }

                .build-output code {
                    max-height: 265px;
                }

                .code-preview code {
                    line-height: 1.357em;
                    border-radius: 0.1875rem;
                    color: var(--vscode-editor-foreground);
                    margin: 0 0.125rem;
                    /* white-space: pre-wrap; */
                    /* add scroll */
                    display: block;
                    overflow: scroll;
                }

            </style>`;
    }

    protected getContent(): string {
        const content = this.data.content;
        const compiler: any = ptaCompiler[content.compiler as keyof typeof ptaCompiler];
        let cases: string = "";
        for (const i in content.testcaseJudgeResults) {
            const testcaseJudgeResult = content.testcaseJudgeResults[i];
            const testCase = content.testCases[i];
            const scoreText = testCase !== undefined ? `${testcaseJudgeResult.testcaseScore} / ${testCase.score}` : testcaseJudgeResult.testcaseScore;
            cases += `
            <tr>
                <td>${i}</td>
                <td class="visible">${content.hints[i]}</td>
                ${solutionStatusMapping.get(testcaseJudgeResult.result)}
                <td>${scoreText}</td>
                <td>${(testcaseJudgeResult.time * 1000).toFixed()}ms</td>
                <td>${testcaseJudgeResult.memory / 1024}KB</td>
            </tr>
            `;
        }

        const scoreText = content.totalScore ? `${content.score} / ${content.totalScore}` : content.score;
        const timeText = content.timeLimit ? `${(content.time * 1000).toFixed()} / ${content.timeLimit}ms` : `${(content.time * 1000).toFixed()}ms`;

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
                        <td>${this.formatDate(new Date(content.submitAt))}</td>
                        ${solutionStatusMapping.get(content.status)}
                        <td>${scoreText}</td>
                        <td>${problemTypeInfoMapping.get(content.problemType)?.name ?? "Unknown"}</td>
                        <td>${compiler.language} (${compiler.displayName})</td>
                        <td>${timeText}</td>
                        <td>${content.nickname}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div ${content.status === "COMPILE_ERROR" ? "style='display: none;'" : ""}" >
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
        <div class="code-block build-output">
            <pre><code>${content.compilationOutput}</code></pre>
        </div>

        <h2>代码</h2>
        <div class="code-block code-preview">
            ${markdownEngine.render(["```" + compiler.language, content.program, "```"].join("\n"))}
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