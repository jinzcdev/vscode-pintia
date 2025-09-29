import * as vscode from "vscode";
import { IProblem } from "../entity/IProblem";
import { IProblemSubmissionResult } from "../entity/IProblemSubmissionResult";
import { IProblemSubmissionDetail } from "../entity/problemSubmissionCode";
import { ProblemJudgingStatusEnum, ProblemType, problemTypeInfoMapping, ptaCompiler, problemJudgingStatusMapping, UNKNOWN, NONE } from "../shared";
import { ptaApi } from "../utils/api";
import { PtaWebviewWithCodeStyle } from "./PtaWebviewWithCodeStyle";
import * as markdownEngine from "./markdownEngine";
import { getNonce, IWebViewMessage } from "./PtaWebview";
import { getGlobalContext } from "../extension";
import { ProblemView } from "./views/ProblemView";
import { defaultIfBlank } from "../utils/stringUtils";

export class PtaSubmissionProvider extends PtaWebviewWithCodeStyle<IProblemSubmissionResult> {

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

        const problemConfig = ProblemView.parseProblemConfig(problem);
        const testCases = problemConfig && typeof problemConfig === 'object' ? problemConfig.cases : [];

        const hints = result.submission.hints;
        const isHint: boolean = Object.values(hints).some((hint: any) => typeof hint === "string" && hint.trim().length > 0);
        this.data = {
            title: `提交结果 | ${problem.title}`,
            isHint: isHint,
            content: {
                totalScore: problem.score,
                timeLimit: problemConfig?.timeLimit ?? UNKNOWN,
                memoryLimit: problemConfig?.memoryLimit ?? UNKNOWN,
                nickname: result.user?.nickname,
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
                compilationOutput: defaultIfBlank(codeJudgeResponseContent?.compilationResult?.log, NONE),
                program: result.submission.problemType === ProblemType.PROGRAMMING ?
                    submissionDetail.programmingSubmissionDetail!.program :
                    submissionDetail.codeCompletionSubmissionDetail!.program
            }
        };
    }

    protected getStyle(): string {
        return super.getStyle() + `\n<style>${this.data.isHint ? "" : " .visible { display: none; } "}</style>`;
    }

    protected getContent(): string {
        const content = this.data.content;
        const compiler: any = ptaCompiler[content.compiler as keyof typeof ptaCompiler];
        let cases: string = "";
        for (const i in content.testcaseJudgeResults) {
            const testcaseJudgeResult = content.testcaseJudgeResults[i];
            const testCase = content.testCases[i];
            const scoreText = testCase !== undefined ? `${testcaseJudgeResult.testcaseScore} / ${testCase.score}` : testcaseJudgeResult.testcaseScore;
            const testcaseJudgingStatus = problemJudgingStatusMapping.get(testcaseJudgeResult.result)
            cases += `
            <tr>
                <td>${i}</td>
                <td class="visible">${content.hints[i]}</td>
                <td style="color: ${testcaseJudgingStatus?.color ?? "inherit"};">${testcaseJudgingStatus?.text ?? testcaseJudgeResult.result}</td>
                <td>${scoreText}</td>
                <td>${(testcaseJudgeResult.time * 1000).toFixed()}ms</td>
                <td>${testcaseJudgeResult.memory / 1024}KB</td>
            </tr>
            `;
        }

        const scoreText = content.totalScore ? `${content.score} / ${content.totalScore}` : content.score;
        const timeText = content.timeLimit ? `${(content.time * 1000).toFixed()} / ${content.timeLimit}ms` : `${(content.time * 1000).toFixed()}ms`;

        const copyButtonScriptUri = this.getWebview()?.asWebviewUri(vscode.Uri.joinPath(getGlobalContext().extensionUri, "media", "main.js"));
        const problemJudgingStatus = problemJudgingStatusMapping.get(content.status);
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
                        <td style="color: ${problemJudgingStatus?.color ?? "inherit"};">${problemJudgingStatus?.text ?? content.status}</td>
                        <td>${scoreText}</td>
                        <td>${problemTypeInfoMapping.get(content.problemType)?.name ?? UNKNOWN}</td>
                        <td>${compiler.language} (${compiler.displayName})</td>
                        <td>${timeText}</td>
                        <td>${content.nickname}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div ${content.status === ProblemJudgingStatusEnum.COMPILE_ERROR ? "style='display: none;'" : ""}" >
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
            <pre><code>${escapeHtml(content.compilationOutput)}</code></pre>
        </div>

        <h2>代码</h2>
        <div class="code-block code-preview">
            ${markdownEngine.render(["```" + compiler.language, content.program.replace(/```/g, '\\```'), "```"].join("\n"))}
        </div>

        <script nonce="${getNonce()}" src="${copyButtonScriptUri}"></script>
        `
    }

    protected async onDidReceiveMessage(msg: IWebViewMessage): Promise<void> {
        switch (msg.type) {
            case "text":
                vscode.window.showInformationMessage(msg.value);
                break;
            default:
        }
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear(),
            month = date.getMonth() + 1,
            day = date.getDate(),
            hour = date.getHours(),
            minute = date.getMinutes(),
            second = date.getSeconds();
        const f = (e: number) => e < 10 ? '0' + e : e;
        return `${year}/${month}/${day} ${f(hour)}:${f(minute)}:${f(second)}`;
    }
}

function escapeHtml(unsafe: string): string {
    return unsafe.replace(/[&<"'>]/g, function (match) {
        const escapeMap = new Map<string, string>([
            ['&', '&amp;'],
            ['<', '&lt;'],
            ['>', '&gt;'],
            ['"', '&quot;'],
            ["'", '&#039;']
        ]);
        return escapeMap.get(match) ?? match;
    });
}