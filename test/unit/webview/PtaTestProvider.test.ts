import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IProblem } from "../../../src/entity/IProblem";
import { IProblemSubmissionResult } from "../../../src/entity/IProblemSubmissionResult";
import { TestSample } from "../../../src/utils/testSamples";
import { PtaTestProvider } from "../../../src/webview/PtaTestProvider";
import { TestCaseEntry, TestView } from "../../../src/webview/views/TestView";
import { resetVscodeMock } from "../../setup";

const problem = {
    title: "A+B",
    problemConfig: {
        programmingProblemConfig: { exampleTestDatas: [] },
        codeCompletionProblemConfig: undefined,
    },
    content: "",
} as unknown as IProblem;

function createSample(input: string, expected?: string): TestSample {
    return {
        id: "default:0",
        source: "default",
        index: 0,
        input,
        expected,
    };
}

function createResult(stdout: string, status: string = "NEUTRAL"): IProblemSubmissionResult {
    return {
        submission: {
            problemType: "PROGRAMMING",
            compiler: "GXX",
            time: 0.01,
            memory: 100,
            submissionDetails: [
                {
                    customTestData: {
                        hasCustomTestData: true,
                        content: "1 2\n",
                    },
                },
            ],
            judgeResponseContents: [
                {
                    status,
                    programmingJudgeResponseContent: {
                        compilationResult: { log: "", success: true, error: "" },
                        testcaseJudgeResults: {
                            custom: {
                                stdout,
                                stderr: "",
                                time: 0.01,
                                memory: 100,
                                stdoutTruncated: false,
                            },
                        },
                    },
                },
            ],
        },
    } as unknown as IProblemSubmissionResult;
}

function doneCase(sample: TestSample, stdout: string, status: string = "NEUTRAL"): TestCaseEntry {
    return { sample, phase: "done", result: createResult(stdout, status) };
}

describe("PtaTestProvider - 测试结果页", () => {
    let capturedPanel: { webview: { html: string } } | undefined;

    beforeEach(() => {
        resetVscodeMock();
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    async function renderHtml(cases: TestCaseEntry[]): Promise<string> {
        const view = new TestView(problem, "GXX", cases);
        const panelStub = vscode.window.createWebviewPanel as sinon.SinonStub;
        await PtaTestProvider.createOrUpdate(view).show();

        if (panelStub.called) {
            capturedPanel = panelStub.lastCall.returnValue;
        }
        assert.ok(capturedPanel, "webview 面板从未被创建");
        return capturedPanel!.webview.html;
    }

    it("失败的样例应展示 Failed、左右 diff 与行号", async () => {
        const html = await renderHtml([doneCase(createSample("1 2", "3"), "4")]);

        assert.strictEqual(html.includes('class="badge failed"'), true);
        assert.strictEqual(html.includes('class="diff'), true);
        assert.strictEqual(html.includes("removed"), true);
        assert.strictEqual(html.includes("added"), true);
        assert.strictEqual(html.includes("#1"), true);
    });

    it("输出仅行尾空白不同时应判为通过并提示", async () => {
        const html = await renderHtml([doneCase(createSample("1 2", "3"), "3 ")]);

        assert.strictEqual(html.includes('class="badge passed"'), true);
        assert.strictEqual(html.includes("Passed (trailing whitespace ignored)"), true);
        assert.strictEqual(html.includes('class="badge failed"'), false);
    });

    it("没有期望输出时应标记为 Not checked，不判失败", async () => {
        const html = await renderHtml([doneCase(createSample("1 2"), "4")]);

        assert.strictEqual(html.includes('class="badge not-checked"'), true);
        assert.strictEqual(html.includes("No official answer for this sample"), true);
        assert.strictEqual(html.includes('class="badge failed"'), false);
    });

    it("多条结果应同时展示并汇总统计", async () => {
        const html = await renderHtml([
            doneCase(createSample("1", "2"), "2"),
            doneCase(createSample("2", "3"), "4"),
            doneCase(createSample("3"), "5"),
        ]);

        assert.strictEqual(html.includes("1 passed"), true);
        assert.strictEqual(html.includes("1 failed"), true);
        assert.strictEqual(html.includes("1 not checked"), true);
        assert.strictEqual(html.includes("#3"), true);
    });

    it("pending / running / cancelled / error 状态都应能渲染", async () => {
        const html = await renderHtml([
            { sample: createSample("1"), phase: "pending" },
            { sample: createSample("2"), phase: "running" },
            { sample: createSample("3"), phase: "cancelled" },
            { sample: createSample("4"), phase: "error", error: "boom" },
        ]);

        assert.strictEqual(html.includes("Pending"), true);
        assert.strictEqual(html.includes("Running"), true);
        assert.strictEqual(html.includes("Cancelled"), true);
        assert.strictEqual(html.includes("boom"), true);
    });

    it("输出中的 HTML 应被转义", async () => {
        const html = await renderHtml([doneCase(createSample("1", "safe"), "<script>alert(1)</script>")]);

        assert.strictEqual(html.includes("<script>alert(1)</script>"), false);
        assert.strictEqual(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
    });

    it("缺少判题字段时不应抛异常", async () => {
        const result = {
            submission: {
                problemType: "PROGRAMMING",
                compiler: "GXX",
                submissionDetails: [],
                judgeResponseContents: [],
            },
        } as unknown as IProblemSubmissionResult;

        const html = await renderHtml([{ sample: createSample("1"), phase: "done", result }]);

        assert.strictEqual(html.includes("Not checked"), true);
    });

    it("运行超时等非 NEUTRAL 状态即使输出一致也应判失败", async () => {
        const html = await renderHtml([doneCase(createSample("1", "3"), "3", "TIME_LIMIT_EXCEEDED")]);

        assert.strictEqual(html.includes('class="badge failed"'), true);
        assert.strictEqual(html.includes("Time Limit Exceeded"), true);
    });
});
