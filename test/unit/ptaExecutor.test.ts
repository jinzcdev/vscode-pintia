import * as assert from "assert";
import * as sinon from "sinon";
import { IProblem } from "../../src/entity/IProblem";
import { IProblemSetExam } from "../../src/entity/IProblemSetExam";
import { IProblemSubmission } from "../../src/entity/IProblemSubmission";
import { IProblemSubmissionResult } from "../../src/entity/IProblemSubmissionResult";
import { ptaExecutor } from "../../src/ptaExecutor";
import { ptaManager } from "../../src/ptaManager";
import { ProblemPermissionEnum, ProblemType } from "../../src/shared";
import { ptaApi } from "../../src/utils/api";
import * as polling from "../../src/utils/polling";

/**
 * 轮询已结束的评测结果。这里只关心「回调是否收到结果」，
 * 因此把结构断言留给各自 provider 的测试。
 */
function createFinishedResult(): IProblemSubmissionResult {
    return {
        queued: -1,
        submission: { status: "ACCEPTED" },
    } as unknown as IProblemSubmissionResult;
}

describe("ptaExecutor - 提交与自定义测试", () => {
    let pollUntilStub: sinon.SinonStub;
    let submitSolutionStub: sinon.SinonStub;
    let getProblemTestResultStub: sinon.SinonStub;

    beforeEach(() => {
        sinon.stub(ptaApi, "getProblem").resolves({ type: ProblemType.PROGRAMMING } as unknown as IProblem);
        sinon.stub(ptaApi, "getProblemSetPermission").resolves(ProblemPermissionEnum.UNKNOWN);
        sinon.stub(ptaApi, "getProblemSetExams").resolves({ exam: { id: "exam1" } } as unknown as IProblemSetExam);
        submitSolutionStub = sinon
            .stub(ptaApi, "submitSolution")
            .resolves({ submissionId: "s1" } as unknown as IProblemSubmission);
        sinon.stub(ptaApi, "createProblemSetExamAndReturn").resolves({ id: "exam1" } as never);
        pollUntilStub = sinon.stub(polling, "pollUntil").resolves(createFinishedResult());
        getProblemTestResultStub = sinon.stub(ptaApi, "getProblemTestResult").resolves(createFinishedResult());
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("submitSolution", () => {
        it("未登录时应提示并直接返回，不发起任何请求", async () => {
            sinon.stub(ptaManager, "getUserSession").returns(undefined);
            const callback = sinon.stub();

            await ptaExecutor.submitSolution("ps1", "p1", { compiler: "GXX", code: "int main(){}" }, callback);

            assert.strictEqual(submitSolutionStub.called, false);
            assert.strictEqual(pollUntilStub.called, false);
            assert.strictEqual(callback.called, false);
        });

        it("提交成功时应回调 SUCCESS 并带上评测结果", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            const callback = sinon.stub();

            await ptaExecutor.submitSolution("ps1", "p1", { compiler: "GXX", code: "int main(){}" }, callback);

            assert.strictEqual(callback.calledOnce, true);
            assert.strictEqual(callback.firstCall.args[0], "SUCCESS");
            assert.deepStrictEqual(callback.firstCall.args[1], createFinishedResult());
        });

        it("应以 exam id 提交，并带上题型与代码", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);

            await ptaExecutor.submitSolution("ps1", "p1", { compiler: "GXX", code: "int main(){}" }, sinon.stub());

            const [examID, cookie, body] = submitSolutionStub.firstCall.args;
            assert.strictEqual(examID, "exam1");
            assert.strictEqual(cookie, "PTASession=c");
            assert.strictEqual(body.problemType, ProblemType.PROGRAMMING);
            assert.strictEqual(body.details[0].problemSetProblemId, "p1");
            assert.deepStrictEqual(body.details[0].programmingSubmissionDetail, {
                compiler: "GXX",
                program: "int main(){}",
            });
        });

        it("提交接口返回 error 时应向上抛出", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            submitSolutionStub.resolves({ error: { message: "rejected" } } as unknown as IProblemSubmission);

            await assert.rejects(
                ptaExecutor.submitSolution("ps1", "p1", { compiler: "GXX", code: "x" }, sinon.stub()),
                /rejected/
            );
            assert.strictEqual(pollUntilStub.called, false, "提交失败后不应进入轮询");
        });

        it("个人题集缺少 exam 时应拒绝，而不是自动创建", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            (ptaApi.getProblemSetPermission as sinon.SinonStub).resolves(ProblemPermissionEnum.MY_PROBLEM_SET);
            (ptaApi.getProblemSetExams as sinon.SinonStub).resolves({} as unknown as IProblemSetExam);

            await assert.rejects(
                ptaExecutor.submitSolution("ps1", "p1", { compiler: "GXX", code: "x" }, sinon.stub()),
                /does not have exam/
            );
        });

        it("轮询超时时应向上抛出，不再回调 SUCCESS", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            pollUntilStub.rejects(new Error("Submission timeout"));
            const callback = sinon.stub();

            await assert.rejects(
                ptaExecutor.submitSolution("ps1", "p1", { compiler: "GXX", code: "x" }, callback),
                /Submission timeout/
            );
            assert.strictEqual(callback.called, false);
        });
    });

    describe("testSolution", () => {
        it("自定义测试应轮询测试结果接口，并回调 SUCCESS", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            const callback = sinon.stub();

            await ptaExecutor.testSolution("ps1", "p1", { compiler: "GXX", code: "x", testInput: "1 2" }, callback);

            assert.strictEqual(callback.calledOnce, true);
            assert.strictEqual(callback.firstCall.args[0], "SUCCESS");
            assert.strictEqual(getProblemTestResultStub.called, false, "轮询已被 stub，不应真正请求");
        });

        it("应把测试输入放进 customTestData，并补齐结尾换行", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);

            await ptaExecutor.testSolution("ps1", "p1", { compiler: "GXX", code: "x", testInput: "1 2" }, sinon.stub());

            const body = submitSolutionStub.firstCall.args[2];
            assert.deepStrictEqual(body.details[0].customTestData, {
                hasCustomTestData: true,
                content: "1 2\n",
            });
        });

        it("测试输入已带换行时不应重复追加", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);

            await ptaExecutor.testSolution(
                "ps1",
                "p1",
                { compiler: "GXX", code: "x", testInput: "1 2\n" },
                sinon.stub()
            );

            const body = submitSolutionStub.firstCall.args[2];
            assert.strictEqual(body.details[0].customTestData.content, "1 2\n");
        });

        it("未登录时应提示并直接返回", async () => {
            sinon.stub(ptaManager, "getUserSession").returns(undefined);
            const callback = sinon.stub();

            await ptaExecutor.testSolution("ps1", "p1", { compiler: "GXX", code: "x", testInput: "1" }, callback);

            assert.strictEqual(submitSolutionStub.called, false);
            assert.strictEqual(callback.called, false);
        });
    });
});
