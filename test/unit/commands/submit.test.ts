import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { submitSolution, testSolution } from "../../../src/commands/submit";
import { IProblem } from "../../../src/entity/IProblem";
import { IProblemSubmissionResult } from "../../../src/entity/IProblemSubmissionResult";
import { explorerController } from "../../../src/explorer/explorerController";
import { ptaExecutor } from "../../../src/ptaExecutor";
import { timerController } from "../../../src/timer/timerController";
import { timerManager } from "../../../src/timer/timerManager";
import { ptaApi } from "../../../src/utils/api";
import { PtaSubmissionProvider } from "../../../src/webview/PtaSubmissionProvider";
import { resetVscodeMock } from "../../setup";

/** 造一个只带 problemConfig 的题目，用于控制 exampleTestDatas */
function createProblem(exampleTestDatas: Array<{ name: string; input: string; output: string }> | undefined): IProblem {
    return {
        problemConfig: {
            programmingProblemConfig: exampleTestDatas ? { exampleTestDatas } : undefined,
            codeCompletionProblemConfig: undefined,
        },
        content: "题面",
    } as unknown as IProblem;
}

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

    /** 取出第一次弹框给出的选项标签 */
    async function offeredLabels(problem: IProblem): Promise<string[]> {
        sinon.stub(ptaApi, "getProblem").resolves(problem);
        await testSolution({ psID: "ps1", pID: "p1", compiler: "GXX", code: "int main(){}" });
        const picks = pickStub.firstCall.args[0] as Array<{ label: string }>;
        return picks.map((p) => p.label);
    }

    it("题目没有默认测试样例时不应给出「默认测试用例」选项", async () => {
        // 回归：此前会列出一条写着「未提供默认测试用例」的选项，点进去是空的
        const labels = await offeredLabels(createProblem([]));

        assert.strictEqual(
            labels.some((label) => label.includes("Default test cases")),
            false,
            `不应出现该选项，实际选项: ${labels.join(" | ")}`
        );
    });

    it("题目配置里没有编程题配置时也不应给出该选项", async () => {
        const labels = await offeredLabels(createProblem(undefined));

        assert.strictEqual(
            labels.some((label) => label.includes("Default test cases")),
            false
        );
    });

    it("题目有默认测试样例时应给出该选项", async () => {
        const labels = await offeredLabels(
            createProblem([
                { name: "1", input: "1 2", output: "3" },
                { name: "2", input: "3 4", output: "7" },
            ])
        );

        assert.strictEqual(
            labels.some((label) => label.includes("Default test cases")),
            true,
            `应出现该选项，实际选项: ${labels.join(" | ")}`
        );
    });

    it("「直接输入」与「从文件读取」应始终提供", async () => {
        const labels = await offeredLabels(createProblem([]));

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
