import * as assert from "assert";
import * as sinon from "sinon";
import * as fs from "fs-extra";
import * as httpUtils from "../../src/utils/httpUtils";
import { ptaApi } from "../../src/utils/api";
import { ptaManager } from "../../src/ptaManager";
import { ProblemSetExamStatus } from "../../src/shared";

describe("api - 未开始题集 403 处理", () => {
    let httpGetStub: sinon.SinonStub;

    beforeEach(() => {
        httpGetStub = sinon.stub(httpUtils, "httpGet");
        sinon.stub(fs, "pathExists").resolves(false);
        sinon.stub(fs, "createFile").resolves();
        sinon.stub(fs, "writeJson").resolves();
        sinon.stub(ptaManager, "getUserSession").returns(undefined);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("getProblemSummary", () => {
        it("403 无权限时返回空摘要且不抛错", async () => {
            httpGetStub.resolves(undefined);

            const summaries = await ptaApi.getProblemSummary("2048056131767074816", "cookie=test");

            assert.deepStrictEqual(summaries, {});
            assert.strictEqual(
                httpGetStub.calledWith(
                    "https://pintia.cn/api/problem-sets/2048056131767074816/problem-summaries",
                    "cookie=test",
                    { silentStatusCodes: [403] }
                ),
                true
            );
        });

        it("正常响应时返回 summaries 字段", async () => {
            httpGetStub.resolves({
                summaries: {
                    PROGRAMMING: { total: 5, totalScore: 100, totalInPools: 5 },
                },
            });

            const summaries = await ptaApi.getProblemSummary("ps-active");

            assert.strictEqual(summaries.PROGRAMMING.total, 5);
        });
    });

    describe("getMyProblemSets", () => {
        const pendingPsId = "2048056131767074816";
        const activePsId = "ps-active";

        beforeEach(() => {
            httpGetStub.callsFake(async (url: string) => {
                if (url.includes("filter=")) {
                    return {
                        problemSets: [
                            { id: pendingPsId, name: "期末考核" },
                            { id: activePsId, name: "算法练习" },
                        ],
                    };
                }
                if (url.endsWith(`${pendingPsId}/exams`)) {
                    return {
                        status: ProblemSetExamStatus.PENDING,
                        permission: { permission: 47 },
                    };
                }
                if (url.endsWith(`${activePsId}/exams`)) {
                    return {
                        status: ProblemSetExamStatus.PROCESSING,
                        exam: { id: "exam-1" },
                        permission: { permission: 47 },
                    };
                }
                if (url.endsWith(`${activePsId}/problem-summaries`)) {
                    return {
                        summaries: {
                            PROGRAMMING: { total: 2, totalScore: 20, totalInPools: 2 },
                        },
                    };
                }
                return undefined;
            });
        });

        it("未开始题集跳过 problem-summaries 请求", async () => {
            const result = await ptaApi.getMyProblemSets("cookie=test", true, false);

            assert.strictEqual(result.length, 2);
            const pendingSet = result.find((item) => item.id === pendingPsId);
            const activeSet = result.find((item) => item.id === activePsId);

            assert.deepStrictEqual(pendingSet?.summaries, {});
            assert.strictEqual(activeSet?.summaries?.PROGRAMMING?.total, 2);

            const summaryRequests = httpGetStub
                .getCalls()
                .filter((call) => String(call.args[0]).includes("problem-summaries"));
            assert.strictEqual(summaryRequests.length, 1);
            assert.strictEqual(String(summaryRequests[0].args[0]).includes(activePsId), true);
        });

        it("未开始题集仍保留 permission 信息", async () => {
            const result = await ptaApi.getMyProblemSets("cookie=test", true, false);
            const pendingSet = result.find((item) => item.id === pendingPsId);

            assert.strictEqual(pendingSet?.permission?.permission, 47);
        });
    });

    describe("getAlwaysAvailableProblemSets", () => {
        it("批量接口无摘要且 getProblemSummary 返回空时不抛错", async () => {
            httpGetStub.callsFake(async (url: string) => {
                if (url.endsWith("/always-available")) {
                    return {
                        problemSets: [{ id: "locked-ps", name: "锁定题集" }],
                        problemSetSummaryByProblemSetId: {},
                    };
                }
                if (url.includes("problem-summaries")) {
                    return undefined;
                }
                if (url.includes("/exams")) {
                    return { permission: { permission: 9 } };
                }
                return undefined;
            });

            const result = await ptaApi.getAlwaysAvailableProblemSets(undefined, true);

            assert.deepStrictEqual(result, []);
        });
    });
});
