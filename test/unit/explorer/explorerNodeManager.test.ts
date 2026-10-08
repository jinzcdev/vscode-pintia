import * as assert from "assert";
import * as sinon from "sinon";
import { explorerNodeManager } from "../../../src/explorer/explorerNodeManager";
import { PtaNode } from "../../../src/explorer/PtaNode";
import { favoriteProblemsManager } from "../../../src/favorites/favoriteProblemsManager";
import { IProblemInfo } from "../../../src/entity/IProblemInfo";
import { ptaApi } from "../../../src/utils/api";
import { ptaConfig } from "../../../src/ptaConfig";
import { ptaManager } from "../../../src/ptaManager";
import {
    defaultPtaNode,
    ProblemPermissionEnum,
    ProblemSubmissionState,
    ProblemType,
    PtaDashType,
    PtaNodeType,
} from "../../../src/shared";

/** 构造一个题集节点（含 summaries） */
function createProblemSetNode(overrides: Partial<{ psID: string; summaries: Record<string, unknown> }> = {}): PtaNode {
    return new PtaNode({
        ...defaultPtaNode,
        psID: overrides.psID ?? "ps1",
        label: "Test Set",
        type: PtaNodeType.ProblemSet,
        value: {
            ...defaultPtaNode.value,
            problemSet: "Test Set",
            summaries: (overrides.summaries ?? {
                PROGRAMMING: { total: 1, totalScore: 10, totalInPools: 1 },
            }) as never,
        },
    });
}

/** 构造若干题目元信息 */
function createProblemInfos(count: number): IProblemInfo[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `p${i}`,
        label: `1-${i}`,
        score: (i + 1) * 10,
        deadline: "",
        acceptCount: 0,
        submitCount: 0,
        title: `T${i}`,
        type: ProblemType.PROGRAMMING,
        compiler: "GXX",
        problemStatus: "",
        problemSetId: "ps1",
        problemPoolIndex: 0,
        indexInProblemPool: 0,
    }));
}

describe("ExplorerNodeManager", () => {
    afterEach(() => {
        sinon.restore();
    });

    describe("getSubProblemSet", () => {
        it("应只保留受支持的题型", async () => {
            const node = createProblemSetNode({
                summaries: {
                    PROGRAMMING: { total: 1, totalScore: 10, totalInPools: 1 },
                    CODE_COMPLETION: { total: 2, totalScore: 20, totalInPools: 2 },
                    TRUE_OR_FALSE: { total: 3, totalScore: 30, totalInPools: 3 },
                },
            });

            const nodes = await explorerNodeManager.getSubProblemSet(node);

            assert.deepStrictEqual(
                nodes.map((n) => n.label),
                ["编程题", "函数题"]
            );
            assert.strictEqual(
                nodes.every((n) => n.type === PtaNodeType.ProblemSubSet),
                true
            );
            assert.strictEqual(
                nodes.every((n) => n.psID === "ps1"),
                true
            );
        });

        it("子节点应带上各自的题型", async () => {
            const node = createProblemSetNode({
                summaries: {
                    PROGRAMMING: { total: 1, totalScore: 10, totalInPools: 1 },
                    CODE_COMPLETION: { total: 2, totalScore: 20, totalInPools: 2 },
                },
            });

            const nodes = await explorerNodeManager.getSubProblemSet(node);

            assert.deepStrictEqual(
                nodes.map((n) => n.value.problemType),
                [ProblemType.PROGRAMMING, ProblemType.CODE_COMPLETION]
            );
        });

        it("无受支持题型时应返回空数组", async () => {
            const node = createProblemSetNode({
                summaries: { TRUE_OR_FALSE: { total: 1, totalScore: 10, totalInPools: 1 } },
            });

            assert.deepStrictEqual(await explorerNodeManager.getSubProblemSet(node), []);
        });
    });

    describe("getProblemSetPageNodes", () => {
        it("应按 limit 拆分区间并标注首尾题号", async () => {
            const node = createProblemSetNode();

            const pages = await explorerNodeManager.getProblemSetPageNodes(node, 250, 100);

            assert.deepStrictEqual(
                pages.map((p) => p.label),
                ["1-100", "101-200", "201-250"]
            );
            assert.deepStrictEqual(
                pages.map((p) => p.value.page),
                [0, 1, 2]
            );
            assert.strictEqual(
                pages.every((p) => p.type === PtaNodeType.ProblemPage),
                true
            );
            assert.strictEqual(
                pages.every((p) => p.value.total === 250 && p.value.limit === 100),
                true
            );
        });

        it("limit 未传时应默认 100", async () => {
            const node = createProblemSetNode();

            const pages = await explorerNodeManager.getProblemSetPageNodes(node, 150);

            assert.deepStrictEqual(
                pages.map((p) => p.label),
                ["1-100", "101-150"]
            );
        });

        it("总数恰好整除时不应产生多余分页", async () => {
            const node = createProblemSetNode();

            const pages = await explorerNodeManager.getProblemSetPageNodes(node, 200, 100);

            assert.strictEqual(pages.length, 2);
        });
    });

    describe("getRootNodes", () => {
        beforeEach(() => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
        });

        it("应按 dashboard 分组，未分组题集归入「其他」", async () => {
            sinon
                .stub(ptaApi, "getDashSections")
                .resolves([{ id: "s1", title: "算法专题", displayConfigs: [{ problemSetId: "ps-in-dash" }] }] as never);
            sinon.stub(ptaApi, "getAlwaysAvailableProblemSets").resolves([
                { id: "ps-in-dash", name: "Dash Set", permission: { permission: 15 } },
                { id: "ps-other", name: "Other", permission: { permission: 15 } },
            ] as never);
            sinon.stub(ptaApi, "getMyProblemSets").resolves([]);
            sinon.stub(ptaConfig, "getShowLocked").returns(true);

            const nodes = await explorerNodeManager.getRootNodes();

            assert.deepStrictEqual(
                nodes.map((n) => n.label),
                ["算法专题", "Dash Set", PtaDashType.Others, "Other"]
            );
        });

        it("showLocked 为 false 时应过滤锁定题集", async () => {
            sinon.stub(ptaApi, "getDashSections").resolves([]);
            sinon.stub(ptaApi, "getAlwaysAvailableProblemSets").resolves([
                { id: "ps-open", name: "Open", permission: { permission: 15 } },
                { id: "ps-locked", name: "Locked", permission: { permission: ProblemPermissionEnum.LOCKED } },
            ] as never);
            sinon.stub(ptaApi, "getMyProblemSets").resolves([]);
            sinon.stub(ptaConfig, "getShowLocked").returns(false);

            const nodes = await explorerNodeManager.getRootNodes();

            assert.deepStrictEqual(
                nodes.filter((n) => n.type === PtaNodeType.ProblemSet).map((n) => n.label),
                ["Open"]
            );
        });

        it("我的题集应单独成组并标记 isMyProblemSet", async () => {
            sinon.stub(ptaApi, "getDashSections").resolves([]);
            sinon.stub(ptaApi, "getAlwaysAvailableProblemSets").resolves([]);
            sinon.stub(ptaApi, "getMyProblemSets").resolves([{ id: "ps-mine", name: "Mine", summaries: {} }] as never);
            sinon.stub(ptaConfig, "getShowLocked").returns(true);

            const nodes = await explorerNodeManager.getRootNodes();

            assert.deepStrictEqual(
                nodes.map((n) => n.label),
                [PtaDashType.MyProblemSet, "Mine"]
            );
            assert.strictEqual(nodes[1].isMyProblemSet, true);
        });

        it("所有分组都为空时不应产生任何节点", async () => {
            sinon.stub(ptaApi, "getDashSections").resolves([]);
            sinon.stub(ptaApi, "getAlwaysAvailableProblemSets").resolves([]);
            sinon.stub(ptaApi, "getMyProblemSets").resolves([]);
            sinon.stub(ptaConfig, "getShowLocked").returns(true);

            assert.deepStrictEqual(await explorerNodeManager.getRootNodes(), []);
        });

        it("应以缓存模式读取我的题集列表——issue #24 回归", async () => {
            sinon.stub(ptaApi, "getDashSections").resolves([]);
            sinon.stub(ptaApi, "getAlwaysAvailableProblemSets").resolves([]);
            const getMyProblemSetsStub = sinon.stub(ptaApi, "getMyProblemSets").resolves([]);
            sinon.stub(ptaConfig, "getShowLocked").returns(true);

            await explorerNodeManager.getRootNodes();

            // 第三个参数必须为 true，否则每次刷新都会重发 1+N+M 次请求
            assert.deepStrictEqual(getMyProblemSetsStub.firstCall.args, ["PTASession=c", true, true]);
        });
    });

    describe("getProblemNodes", () => {
        const node = () =>
            new PtaNode({
                ...defaultPtaNode,
                psID: "ps1",
                type: PtaNodeType.ProblemSubSet,
                value: {
                    ...defaultPtaNode.value,
                    problemSet: "Test Set",
                    problemType: ProblemType.PROGRAMMING,
                },
            });

        beforeEach(() => {
            sinon.stub(ptaApi, "checkAndCreateProblemSetExam").resolves({ id: "exam-1" } as never);
            sinon
                .stub(ptaApi, "getExamProblemStatus")
                .resolves([{ id: "p0", problemSubmissionStatus: ProblemSubmissionState.PROBLEM_ACCEPTED }] as never);
            sinon.stub(favoriteProblemsManager, "getCurrentUserId").returns("u1");
            sinon.stub(favoriteProblemsManager, "isFavoriteProblem").returns(false);
        });

        it("未登录时应返回空数组且不请求题目列表", async () => {
            sinon.stub(ptaManager, "getUserSession").returns(undefined);
            const getProblemsStub = sinon.stub(ptaApi, "getAllProblemInfoList").resolves([]);

            assert.deepStrictEqual(await explorerNodeManager.getProblemNodes(node()), []);
            assert.strictEqual(getProblemsStub.called, false);
        });

        it("应带上提交状态与收藏标记", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            sinon.stub(ptaApi, "getAllProblemInfoList").resolves(createProblemInfos(2));

            const nodes = await explorerNodeManager.getProblemNodes(node());

            assert.strictEqual(nodes.length, 2);
            assert.strictEqual(nodes[0].state, ProblemSubmissionState.PROBLEM_ACCEPTED);
            assert.strictEqual(nodes[1].state, ProblemSubmissionState.PROBLEM_NO_ANSWER);
            assert.strictEqual(nodes[0].isFavorite, false);
            assert.strictEqual(nodes[0].psID, "ps1");
            assert.strictEqual(nodes[0].pID, "p0");
        });

        it("分页请求时序号应从页首偏移开始", async () => {
            sinon.stub(ptaManager, "getUserSession").returns({ cookie: "PTASession=c" } as never);
            sinon.stub(ptaApi, "getProblemInfoListByPage").resolves(createProblemInfos(2));

            const nodes = await explorerNodeManager.getProblemNodes(node(), 2, 100);

            assert.deepStrictEqual(
                nodes.map((n) => n.label),
                ["[201] 1-0 T0", "[202] 1-1 T1"]
            );
        });
    });
});
