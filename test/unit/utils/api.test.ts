import * as assert from "assert";
import * as sinon from "sinon";
import * as fs from "fs-extra";
import * as httpUtils from "../../../src/utils/httpUtils";
import { ptaApi } from "../../../src/utils/api";
import { ptaManager } from "../../../src/ptaManager";
import { ptaCache, ProblemPermissionEnum, ProblemType, ProblemSetExamStatus } from "../../../src/shared";
import { IProblemInfo } from "../../../src/entity/IProblemInfo";

/** 生成 count 条题目元信息 */
function createProblemInfos(count: number): IProblemInfo[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `p${i}`,
        label: `1-${i}`,
        score: 10,
        deadline: "",
        acceptCount: 0,
        submitCount: 0,
        title: `T${i}`,
        type: "PROGRAMMING",
        compiler: "GXX",
        problemStatus: "",
        problemSetId: "ps1",
        problemPoolIndex: 0,
        indexInProblemPool: 0,
    }));
}

describe("ptaApi - 请求构造与本地缓存", () => {
    let httpGetStub: sinon.SinonStub;
    let httpPostStub: sinon.SinonStub;
    let pathExistsStub: sinon.SinonStub;

    beforeEach(() => {
        httpGetStub = sinon.stub(httpUtils, "httpGet");
        httpPostStub = sinon.stub(httpUtils, "httpPost").resolves(undefined);
        pathExistsStub = sinon.stub(fs, "pathExists");
        sinon.stub(fs, "createFile").resolves();
        sinon.stub(fs, "writeJson").resolves();
        sinon.stub(fs, "readJSON");
        sinon.stub(ptaManager, "getUserSession").returns(undefined);
        // 避免跨用例复用 psID → 名称等内存缓存
        ptaCache.clear();
        // 默认不存在任何本地缓存
        pathExistsStub.resolves(false);
    });

    afterEach(() => {
        sinon.restore();
        ptaCache.clear();
    });

    /** 让本地缓存文件“存在”并返回给定内容 */
    function mockCachedFile(content: unknown): void {
        pathExistsStub.resolves(true);
        (fs.readJSON as sinon.SinonStub).resolves(content);
    }

    describe("URL 构造", () => {
        it("应按题型 ID 生成题目 URL", () => {
            assert.strictEqual(
                ptaApi.getProblemURL("ps1", "p1", ProblemType.PROGRAMMING),
                "https://pintia.cn/problem-sets/ps1/exam/problems/type/7?problemSetProblemId=p1"
            );
            assert.strictEqual(
                ptaApi.getProblemURL("ps1", "p1", ProblemType.CODE_COMPLETION),
                "https://pintia.cn/problem-sets/ps1/exam/problems/type/6?problemSetProblemId=p1"
            );
            assert.strictEqual(
                ptaApi.getProblemURL("ps1", "p1", ProblemType.TRUE_OR_FALSE),
                "https://pintia.cn/problem-sets/ps1/exam/problems/type/1?problemSetProblemId=p1"
            );
        });

        it("题型为空或未知时应回退到题集 URL", () => {
            const fallback = "https://pintia.cn/problem-sets/ps1";

            assert.strictEqual(ptaApi.getProblemURL("ps1", "p1", ""), fallback);
            assert.strictEqual(ptaApi.getProblemURL("ps1", "p1", "   "), fallback);
            assert.strictEqual(ptaApi.getProblemURL("ps1", "p1", "NOT_A_TYPE"), fallback);
        });

        it("题集 URL 应符合拼题A 路径", () => {
            assert.strictEqual(ptaApi.getProblemSetURL("ps1"), "https://pintia.cn/problem-sets/ps1");
        });
    });

    describe("getProblemSummary", () => {
        it("会话 cookie 应优先于传入的 cookie", async () => {
            (ptaManager.getUserSession as sinon.SinonStub).returns({ cookie: "PTASession=session" });
            httpGetStub.resolves({ summaries: {} });

            await ptaApi.getProblemSummary("ps1", "PTASession=param");

            assert.strictEqual(httpGetStub.firstCall.args[1], "PTASession=session");
        });

        it("无会话时应使用传入的 cookie，并静默 403", async () => {
            httpGetStub.resolves({ summaries: { PROGRAMMING: { total: 3, totalScore: 30, totalInPools: 3 } } });

            const summaries = await ptaApi.getProblemSummary("ps1", "PTASession=param");

            assert.strictEqual(summaries.PROGRAMMING.total, 3);
            assert.deepStrictEqual(httpGetStub.firstCall.args[2], { silentStatusCodes: [403] });
        });

        it("响应缺少 summaries 时应返回空对象", async () => {
            httpGetStub.resolves(undefined);

            assert.deepStrictEqual(await ptaApi.getProblemSummary("ps1"), {});
        });
    });

    describe("fetchExamProblemPage", () => {
        it("应按题型与页码构造请求", async () => {
            httpGetStub.resolves({ problemSetProblems: createProblemInfos(2) });

            const page = await ptaApi.fetchExamProblemPage("ps1", ProblemType.PROGRAMMING, 2, 50, "PTASession=c");

            assert.strictEqual(
                httpGetStub.firstCall.args[0],
                "https://pintia.cn/api/problem-sets/ps1/exam-problem-list?problem_type=PROGRAMMING&page=2&limit=50"
            );
            assert.strictEqual(httpGetStub.firstCall.args[1], "PTASession=c");
            assert.strictEqual(page.length, 2);
        });

        it("未传 cookie 时应回退到会话 cookie", async () => {
            (ptaManager.getUserSession as sinon.SinonStub).returns({ cookie: "PTASession=session" });
            httpGetStub.resolves({});

            await ptaApi.fetchExamProblemPage("ps1", ProblemType.PROGRAMMING, 0, 200);

            assert.strictEqual(httpGetStub.firstCall.args[1], "PTASession=session");
        });

        it("响应缺少题目列表时应返回空数组", async () => {
            httpGetStub.resolves(undefined);

            assert.deepStrictEqual(await ptaApi.fetchExamProblemPage("ps1", ProblemType.PROGRAMMING, 0, 200), []);
        });
    });

    describe("getProblemInfoListByPage", () => {
        beforeEach(() => {
            mockCachedFile(createProblemInfos(10));
        });

        it("命中本地缓存时不应发起请求", async () => {
            await ptaApi.getProblemInfoListByPage("ps1", ProblemType.PROGRAMMING, 0, 3);

            assert.strictEqual(httpGetStub.called, false);
        });

        it("应按下标切片返回指定页", async () => {
            const firstPage = await ptaApi.getProblemInfoListByPage("ps1", ProblemType.PROGRAMMING, 0, 3);
            const lastPage = await ptaApi.getProblemInfoListByPage("ps1", ProblemType.PROGRAMMING, 3, 3);
            const emptyPage = await ptaApi.getProblemInfoListByPage("ps1", ProblemType.PROGRAMMING, 4, 3);

            assert.deepStrictEqual(
                firstPage.map((p) => p.id),
                ["p0", "p1", "p2"]
            );
            assert.deepStrictEqual(
                lastPage.map((p) => p.id),
                ["p9"]
            );
            assert.deepStrictEqual(emptyPage, []);
        });
    });

    describe("getAllProblemInfoList", () => {
        it("缓存非空时应直接返回", async () => {
            mockCachedFile(createProblemInfos(3));

            const list = await ptaApi.getAllProblemInfoList("ps1", ProblemType.PROGRAMMING);

            assert.strictEqual(list.length, 3);
            assert.strictEqual(httpGetStub.called, false);
        });

        it("无缓存时应按 summary 总数分页拉取并写入缓存", async () => {
            httpGetStub.callsFake(async (url: string) => {
                if (String(url).includes("problem-summaries")) {
                    return { summaries: { PROGRAMMING: { total: 2, totalScore: 20, totalInPools: 2 } } };
                }
                return { problemSetProblems: createProblemInfos(2) };
            });

            const list = await ptaApi.getAllProblemInfoList("ps1", ProblemType.PROGRAMMING);

            assert.strictEqual(list.length, 2);
            assert.strictEqual((fs.writeJson as sinon.SinonStub).called, true);
        });
    });

    describe("getProblemInfoByID", () => {
        it("缓存中命中时应直接返回", async () => {
            mockCachedFile(createProblemInfos(5));

            const info = await ptaApi.getProblemInfoByID("ps1", "p3", ProblemType.PROGRAMMING);

            assert.strictEqual(info.id, "p3");
            assert.strictEqual(httpGetStub.called, false);
        });

        it("缓存未命中时应分页扫描接口", async () => {
            httpGetStub.callsFake(async (url: string) => {
                if (String(url).includes("problem-summaries")) {
                    return { summaries: { PROGRAMMING: { total: 3, totalScore: 30, totalInPools: 3 } } };
                }
                return { problemSetProblems: createProblemInfos(3) };
            });

            const info = await ptaApi.getProblemInfoByID("ps1", "p2", ProblemType.PROGRAMMING);

            assert.strictEqual(info.id, "p2");
        });

        it("题目不存在时应 reject", async () => {
            httpGetStub.resolves({ summaries: {} });

            await assert.rejects(() => ptaApi.getProblemInfoByID("ps1", "p-unknown", ProblemType.PROGRAMMING));
        });
    });

    describe("getProblem", () => {
        it("无 cookie 且本地有缓存时应直接返回缓存", async () => {
            mockCachedFile({ id: "p1", title: "Cached" });

            const problem = await ptaApi.getProblem("ps1", "p1");

            assert.strictEqual(problem.title, "Cached");
            assert.strictEqual(httpGetStub.called, false);
        });

        it("传入 cookie 时应绕过缓存并合并 organization", async () => {
            mockCachedFile({ id: "p1", title: "Cached" });
            httpGetStub.resolves({
                problemSetProblem: { id: "p1", title: "Fresh" },
                organization: { id: "org1", name: "Org" },
            });

            const problem = await ptaApi.getProblem("ps1", "p1", "PTASession=c");

            assert.strictEqual(problem.title, "Fresh");
            assert.deepStrictEqual(problem.organization, { id: "org1", name: "Org" });
            assert.strictEqual((fs.writeJson as sinon.SinonStub).called, true, "应回写题目缓存");
        });
    });

    describe("权限相关", () => {
        it("getProblemSetPermission 应返回 permission 字段，缺失时为 -1", async () => {
            httpGetStub.resolves({ permission: { permission: ProblemPermissionEnum.LOCKED } });
            assert.strictEqual(await ptaApi.getProblemSetPermission("ps1"), ProblemPermissionEnum.LOCKED);

            httpGetStub.resolves({});
            assert.strictEqual(await ptaApi.getProblemSetPermission("ps1"), -1);
        });

        it("isMyProblemSet 仅对 MY_PROBLEM_SET 权限返回 true", async () => {
            httpGetStub.resolves({ permission: { permission: ProblemPermissionEnum.MY_PROBLEM_SET } });
            assert.strictEqual(await ptaApi.isMyProblemSet("ps1"), true);

            httpGetStub.resolves({ permission: { permission: ProblemPermissionEnum.LOCKED } });
            assert.strictEqual(await ptaApi.isMyProblemSet("ps1"), false);
        });

        it("getUnlockedProblemSetIDs 应只排除明确锁定的题集", async () => {
            sinon
                .stub(ptaApi, "getAlwaysAvailableProblemSets")
                .resolves([
                    { id: "unlocked", permission: { permission: 15 } },
                    { id: "locked", permission: { permission: ProblemPermissionEnum.LOCKED } },
                    { id: "unknown" },
                ] as never);

            const ids = await ptaApi.getUnlockedProblemSetIDs("PTASession=c");

            // 权限缺失时按 UNKNOWN(-1) 处理，不等同于 LOCKED，因此仍视为可访问
            assert.deepStrictEqual(ids, ["unlocked", "unknown"]);
        });
    });

    describe("getProblemSetName", () => {
        it("命中内存缓存时不应发起请求", async () => {
            ptaCache.put("psID2name", new Map([["ps1", "数组练习"]]));

            const name = await ptaApi.getProblemSetName("ps1");

            assert.strictEqual(name, "数组练习");
            assert.strictEqual(httpGetStub.called, false);
        });

        it("缓存未命中时应回退到 exams 接口", async () => {
            ptaCache.put("psID2name", new Map());
            httpGetStub.resolves({ problemSet: { id: "ps1", name: "Fallback" } });

            const name = await ptaApi.getProblemSetName("ps1");

            assert.strictEqual(name, "Fallback");
        });
    });

    describe("考试（exam）相关", () => {
        it("已有 exam 时不应重复创建", async () => {
            httpGetStub.resolves({ exam: { id: "exam-1" } });

            const exam = await ptaApi.checkAndCreateProblemSetExam("ps1", "PTASession=c");

            assert.strictEqual(exam.id, "exam-1");
            assert.strictEqual(httpPostStub.called, false);
        });

        it("无 exam 时应创建后重新获取", async () => {
            httpGetStub.onFirstCall().resolves({});
            httpGetStub.onSecondCall().resolves({ exam: { id: "exam-2" } });

            const exam = await ptaApi.checkAndCreateProblemSetExam("ps1", "PTASession=c");

            assert.strictEqual(exam.id, "exam-2");
            assert.strictEqual(httpPostStub.firstCall.args[0], "https://pintia.cn/api/problem-sets/ps1/exams");
        });

        it("getExamProblemStatus 在 autoCreate 时应先创建 exam", async () => {
            httpGetStub.resolves({ problemStatus: [{ id: "p1", problemSubmissionStatus: "PROBLEM_ACCEPTED" }] });

            const status = await ptaApi.getExamProblemStatus("ps1", "PTASession=c", true);

            assert.strictEqual(httpPostStub.called, true);
            assert.strictEqual(status?.length, 1);
        });

        it("getProblemSetStatus 应返回 status 字段", async () => {
            httpGetStub.resolves({ status: ProblemSetExamStatus.PROCESSING });

            assert.strictEqual(await ptaApi.getProblemSetStatus("ps1", "c"), ProblemSetExamStatus.PROCESSING);
        });
    });

    describe("提交与题集信息", () => {
        it("getLastSubmissions 应返回 submission 字段", async () => {
            httpGetStub.resolves({ submission: { id: "s1", status: "ACCEPTED" } });

            const last = await ptaApi.getLastSubmissions("ps1", "p1", "PTASession=c");

            assert.strictEqual(last?.id, "s1");
            assert.strictEqual(
                httpGetStub.firstCall.args[0],
                "https://pintia.cn/api/problem-sets/ps1/last-submissions?&problem_set_problem_id=p1"
            );
        });

        it("提交结果与自定义测试结果的 URL 应区分", async () => {
            httpGetStub.resolves({});

            await ptaApi.getProblemSubmissionResult("s1", "PTASession=c");
            await ptaApi.getProblemTestResult("s1", "PTASession=c");

            assert.strictEqual(httpGetStub.firstCall.args[0], "https://pintia.cn/api/submissions/s1");
            assert.strictEqual(
                httpGetStub.secondCall.args[0],
                "https://pintia.cn/api/submissions/s1?custom_test_data_submission=true"
            );
        });

        it("getProblemSetCompilers 应读取题集配置中的编译器列表", async () => {
            mockCachedFile({ id: "ps1", problemSetConfig: { compilers: ["GXX", "PYTHON3"] } });

            assert.deepStrictEqual(await ptaApi.getProblemSetCompilers("ps1"), ["GXX", "PYTHON3"]);
            assert.strictEqual(httpGetStub.called, false);
        });
    });

    describe("getDashSections", () => {
        it("本地缓存存在时应直接返回", async () => {
            mockCachedFile([{ title: "我的题目集" }]);

            const sections = await ptaApi.getDashSections();

            assert.strictEqual(sections.length, 1);
            assert.strictEqual(httpGetStub.called, false);
        });

        it("无缓存时应请求并解析嵌套 JSON", async () => {
            httpGetStub.resolves({ content: JSON.stringify({ sections: [{ title: "S1" }, { title: "S2" }] }) });

            const sections = await ptaApi.getDashSections();

            assert.deepStrictEqual(
                sections.map((s) => s.title),
                ["S1", "S2"]
            );
            assert.strictEqual((fs.writeJson as sinon.SinonStub).called, true);
        });
    });
});
