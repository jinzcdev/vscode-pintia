import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { submitSolution, testCustomSample, testSolution } from "../../../src/commands/submit";
import { IProblem } from "../../../src/entity/IProblem";
import { IProblemSubmissionResult } from "../../../src/entity/IProblemSubmissionResult";
import { explorerController } from "../../../src/explorer/explorerController";
import { ptaExecutor } from "../../../src/ptaExecutor";
import { timerController } from "../../../src/timer/timerController";
import { timerManager } from "../../../src/timer/timerManager";
import { ptaApi } from "../../../src/utils/api";
import { PtaSubmissionProvider } from "../../../src/webview/PtaSubmissionProvider";
import { PtaTestProvider } from "../../../src/webview/PtaTestProvider";
import { TestView } from "../../../src/webview/views/TestView";
import { resetVscodeMock } from "../../setup";

interface IExample {
    name: string;
    input: string;
    output: string;
}

/** 造一个只带 problemConfig 的题目，用于控制 exampleTestDatas */
function createProblem(exampleTestDatas: IExample[] | undefined, content: string = "题面"): IProblem {
    return {
        problemConfig: {
            programmingProblemConfig: exampleTestDatas ? { exampleTestDatas } : undefined,
            codeCompletionProblemConfig: undefined,
        },
        content,
        title: "题目",
    } as unknown as IProblem;
}

function createPtaCode(customTests?: string[]): {
    psID: string;
    pID: string;
    compiler: string;
    code: string;
    customTests?: string[];
} {
    return { psID: "ps1", pID: "p1", compiler: "GXX", code: "int main(){}", customTests };
}

const defaultSamples: IExample[] = [
    { name: "", input: "1 2", output: "3" },
    { name: "", input: "3 4", output: "7" },
    { name: "", input: "1 2", output: "3" },
    { name: "", input: "3 4", output: "7" },
];

describe("commands/submit - 测试样例的选项", () => {
    let pickStub: sinon.SinonStub;

    beforeEach(() => {
        resetVscodeMock();
        // 在第一个（选项）弹框处直接取消，只观察选项本身
        pickStub = vscode.window.showQuickPick as sinon.SinonStub;
        pickStub.resolves(undefined);
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    /** 取出第一次弹框给出的选项 */
    async function offeredPicks(problem: IProblem): Promise<Array<{ label: string; description?: string }>> {
        sinon.stub(ptaApi, "getProblem").resolves(problem);
        await testSolution(createPtaCode());
        return pickStub.firstCall.args[0] as Array<{ label: string; description?: string }>;
    }

    it("题目没有默认测试样例时不应给出批量/选择样例入口", async () => {
        const picks = await offeredPicks(createProblem([]));
        const labels = picks.map((pick) => pick.label);

        assert.strictEqual(
            labels.some((label) => label.includes("Run all test cases")),
            false,
            `不应出现批量入口，实际选项: ${labels.join(" | ")}`
        );
        assert.strictEqual(
            labels.some((label) => label.includes("Test a sample")),
            false
        );
    });

    it("题目有默认测试样例时应给出批量与选择样例入口", async () => {
        const picks = await offeredPicks(createProblem(defaultSamples));
        const labels = picks.map((pick) => pick.label);

        assert.strictEqual(
            labels.some((label) => label.includes("Run all test cases")),
            true,
            `应出现批量入口，实际选项: ${labels.join(" | ")}`
        );
        assert.strictEqual(
            labels.some((label) => label.includes("Test a sample")),
            true
        );
        assert.strictEqual(picks.find((pick) => pick.label.includes("Run all test cases"))?.description, "2 cases");
    });

    it("只有一个测试样例时也应给出 Run all 选项", async () => {
        const single = [{ name: "", input: "1 2", output: "3" }];
        const picks = await offeredPicks(createProblem([...single, ...single]));
        const runAll = picks.find((pick) => pick.label.includes("Run all test cases"));

        assert.ok(runAll, `实际选项: ${picks.map((pick) => pick.label).join(" | ")}`);
        assert.strictEqual(runAll.description, "1 cases");
    });

    it("「直接输入」与「从文件读取」应始终提供", async () => {
        const labels = (await offeredPicks(createProblem([]))).map((pick) => pick.label);

        assert.strictEqual(
            labels.some((label) => label.includes("Write directly")),
            true
        );
        assert.strictEqual(
            labels.some((label) => label.includes("Browse")),
            true
        );
    });
});

describe("commands/submit - 运行样例", () => {
    let pickStub: sinon.SinonStub;
    let testSolutionsStub: sinon.SinonStub;
    let capturedView: TestView | undefined;

    beforeEach(() => {
        resetVscodeMock();
        capturedView = undefined;
        pickStub = vscode.window.showQuickPick as sinon.SinonStub;

        sinon.stub(ptaApi, "getProblem").resolves(createProblem(defaultSamples, "```in\n5\n```"));
        testSolutionsStub = sinon
            .stub(ptaExecutor, "testSolutions")
            .callsFake(async (_psID, _pID, _solution, inputs, options) => {
                const updates = (inputs as string[]).map((_, index) => {
                    const update = { index, phase: "done" as const, result: {} as IProblemSubmissionResult };
                    return update;
                });
                for (const update of updates) {
                    await options?.onCaseUpdate?.(update);
                }
                return updates;
            });
        sinon.stub(PtaTestProvider, "createOrUpdate").callsFake((view: TestView) => {
            capturedView = capturedView ?? view;
            return { show: sinon.stub().resolves(undefined) } as unknown as PtaTestProvider;
        });
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("运行全部时应按 default → custom → problem 提交全部样例", async () => {
        pickStub.onFirstCall().resolves({ value: "all" });

        await testSolution(createPtaCode(["9"]));

        assert.strictEqual(testSolutionsStub.calledOnce, true);
        assert.deepStrictEqual(testSolutionsStub.firstCall.args[3], ["1 2", "3 4", "9", "5"]);
        assert.strictEqual(capturedView?.cases.length, 4);
        assert.deepStrictEqual(
            capturedView?.cases.map((entry) => entry.sample.source),
            ["default", "default", "custom", "problem"]
        );
    });

    it("二级列表应标注来源并支持多选", async () => {
        pickStub.onFirstCall().resolves({ value: "choose" });
        pickStub.onSecondCall().callsFake((items: unknown[]) => (items as unknown[]).slice(0, 2));

        await testSolution(createPtaCode(["9"]));

        const items = pickStub.secondCall.args[0] as Array<{ label: string; description: string }>;
        assert.deepStrictEqual(
            items.map((item) => item.description),
            ["Default", "Default", "Custom", "From the problem"]
        );
        assert.deepStrictEqual(testSolutionsStub.firstCall.args[3], ["1 2", "3 4"]);
    });

    it("取消二级列表时不应发起测试", async () => {
        pickStub.onFirstCall().resolves({ value: "choose" });
        pickStub.onSecondCall().resolves(undefined);

        await testSolution(createPtaCode());

        assert.strictEqual(testSolutionsStub.called, false);
    });

    it("直接输入也应尝试匹配官方期望输出", async () => {
        pickStub.onFirstCall().resolves({ value: "direct" });
        (vscode.window.showInputBox as sinon.SinonStub).resolves("3 4");

        await testSolution(createPtaCode());

        assert.deepStrictEqual(testSolutionsStub.firstCall.args[3], ["3 4"]);
        assert.strictEqual(capturedView?.cases[0].sample.expected, "7");
    });

    it("CodeLens 的单条自定义样例应走同一套结果视图", async () => {
        await testCustomSample(createPtaCode(["1 2"]), 0);

        assert.deepStrictEqual(testSolutionsStub.firstCall.args[3], ["1 2"]);
        assert.strictEqual(capturedView?.cases[0].sample.source, "custom");
        assert.strictEqual(capturedView?.cases[0].sample.expected, "3");
    });

    it("批处理失败时应把未完成的条目置为错误状态", async () => {
        pickStub.onFirstCall().resolves({ value: "all" });
        testSolutionsStub.rejects(new Error("boom"));

        await testSolution(createPtaCode());

        assert.strictEqual(
            capturedView?.cases.every((entry) => entry.phase === "error"),
            true
        );
        assert.strictEqual(capturedView?.cases[0].error, "boom");
    });
});

describe("commands/submit - AC 计时回调", () => {
    const ptaCode = { psID: "ps1", pID: "p1", compiler: "GXX", code: "int main(){}" };
    const session = { seconds: 754, psName: "期末考核", title: "两数之和" };

    let getSessionStub: sinon.SinonStub;
    let handleStub: sinon.SinonStub;
    let nextMessage: string;
    let nextResult: IProblemSubmissionResult;

    function createResult(status: string): IProblemSubmissionResult {
        return {
            submission: {
                id: "sub1",
                status,
                submitAt: "2026-10-17T10:12:34.000Z",
            },
        } as unknown as IProblemSubmissionResult;
    }

    beforeEach(() => {
        resetVscodeMock();
        nextMessage = "SUCCESS";
        nextResult = createResult("ACCEPTED");

        getSessionStub = sinon.stub(timerManager, "getActiveSession").returns(undefined);
        handleStub = sinon.stub(timerController, "handleAccepted").resolves(undefined);
        sinon.stub(ptaExecutor, "submitSolution").callsFake(async (_psID, _pID, _solution, callback) => {
            await callback(nextMessage, nextMessage === "SUCCESS" ? nextResult : undefined);
        });
        sinon.stub(PtaSubmissionProvider, "createOrUpdate").returns({
            show: sinon.stub().resolves(undefined),
        } as unknown as PtaSubmissionProvider);
        sinon.stub(explorerController, "refreshTreeData");
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("提交时本题在计时且 AC，应把提交时快照交给计时器", async () => {
        getSessionStub.returns(session);

        await submitSolution(ptaCode);

        assert.deepStrictEqual(handleStub.firstCall.args, ["ps1", "p1", "sub1", session, "2026-10-17T10:12:34.000Z"]);
    });

    it("非 AC 不应记录", async () => {
        getSessionStub.returns(session);
        nextResult = createResult("WRONG_ANSWER");

        await submitSolution(ptaCode);

        assert.strictEqual(handleStub.called, false);
    });

    it("提交时没有为本题计时则 AC 也不记录", async () => {
        getSessionStub.returns(undefined);

        await submitSolution(ptaCode);

        assert.strictEqual(handleStub.called, false);
    });

    it("提交失败时不应记录", async () => {
        getSessionStub.returns(session);
        nextMessage = "FAIL";

        await submitSolution(ptaCode);

        assert.strictEqual(handleStub.called, false);
        assert.strictEqual((vscode.window.showInformationMessage as sinon.SinonStub).called, true);
    });
});
