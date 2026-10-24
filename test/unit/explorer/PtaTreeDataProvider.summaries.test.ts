import * as assert from "assert";
import * as sinon from "sinon";
import { PtaTreeDataProvider } from "../../../src/explorer/PtaTreeDataProvider";
import { PtaNode } from "../../../src/explorer/PtaNode";
import { explorerNodeManager } from "../../../src/explorer/explorerNodeManager";
import { createDefaultPtaNode, ProblemType, PtaNodeType } from "../../../src/shared";
import { ptaApi } from "../../../src/utils/api";
import { ptaManager } from "../../../src/ptaManager";
import { ptaConfig } from "../../../src/ptaConfig";

describe("PtaTreeDataProvider - summaries 懒加载", () => {
    let provider: PtaTreeDataProvider;
    let getSummaryStub: sinon.SinonStub;

    beforeEach(() => {
        explorerNodeManager.clearCache();
        provider = new PtaTreeDataProvider({} as never);
        getSummaryStub = sinon.stub(ptaApi, "getProblemSummary");
        sinon.stub(ptaManager, "getUserSession").returns({ cookie: "cookie=test" } as never);
        sinon.stub(ptaConfig, "getPageSize").returns(100);
    });

    afterEach(() => {
        sinon.restore();
        explorerNodeManager.clearCache();
    });

    /** 构造带指定 summaries 的题集节点 */
    function createProblemSetNode(summaries: Record<string, unknown> | undefined): PtaNode {
        return new PtaNode(
            createDefaultPtaNode({
                psID: "2048056131767074816",
                label: "期末考核",
                type: PtaNodeType.ProblemSet,
                value: {
                    problemSet: "期末考核",
                    summaries: summaries as never,
                },
            })
        );
    }

    it("summaries 为空对象时直接返回空列表且不请求 API", async () => {
        const node = createProblemSetNode({});

        const children = await provider.getChildren(node);

        assert.deepStrictEqual(children, []);
        assert.strictEqual(getSummaryStub.called, false);
    });

    it("summaries 为 undefined 且 API 返回空摘要时只请求一次", async () => {
        getSummaryStub.resolves({});
        const node = createProblemSetNode(undefined);

        const first = await provider.getChildren(node);
        const second = await provider.getChildren(node);

        assert.deepStrictEqual(first, []);
        assert.deepStrictEqual(second, []);
        assert.strictEqual(getSummaryStub.callCount, 1);
        assert.deepStrictEqual(node.value.summaries, {});
    });

    it("summaries 为 undefined 且 API 返回有效摘要时会写入并继续展开", async () => {
        getSummaryStub.resolves({
            PROGRAMMING: { total: 1, totalScore: 10, totalInPools: 1 },
        });
        const getProblemNodesStub = sinon.stub(explorerNodeManager, "getProblemNodes").resolves([]);

        const node = createProblemSetNode(undefined);
        await provider.getChildren(node);

        assert.strictEqual(node.value.summaries.PROGRAMMING.total, 1);
        assert.strictEqual(getProblemNodesStub.calledOnce, true);
    });

    it("展开分页节点时不应请求 problem-summaries", async () => {
        // 分页节点的题目数来自 value.total，本就不需要 summaries。
        // 此前它没有 summaries，会掉进懒加载分支，每次展开都白打一次接口。
        const getProblemNodesStub = sinon.stub(explorerNodeManager, "getProblemNodes").resolves([]);
        const pageNode = new PtaNode(
            createDefaultPtaNode({
                psID: "ps1",
                type: PtaNodeType.ProblemPage,
                label: "1-100",
                value: { total: 250, limit: 100, page: 1, problemSet: "期末考核" },
            })
        );

        await provider.getChildren(pageNode);

        assert.strictEqual(getSummaryStub.called, false, "分页节点不应请求 summaries");
        assert.strictEqual(getProblemNodesStub.calledOnce, true);
        assert.deepStrictEqual(getProblemNodesStub.firstCall.args.slice(1), [1, 100], "应带上页码与每页大小");
    });

    it("分页节点即使带有 summaries 也应按分页展开", async () => {
        const getProblemNodesStub = sinon.stub(explorerNodeManager, "getProblemNodes").resolves([]);
        const pageNode = new PtaNode(
            createDefaultPtaNode({
                psID: "ps1",
                type: PtaNodeType.ProblemPage,
                value: {
                    total: 250,
                    limit: 100,
                    page: 2,
                    summaries: { PROGRAMMING: { total: 250, totalScore: 0, totalInPools: 0 } },
                },
            })
        );

        await provider.getChildren(pageNode);

        assert.strictEqual(getProblemNodesStub.calledOnce, true);
        assert.strictEqual(getProblemNodesStub.firstCall.args[1], 2);
    });
});

describe("PtaTreeDataProvider - getParent", () => {
    let provider: PtaTreeDataProvider;

    beforeEach(() => {
        explorerNodeManager.clearCache();
        provider = new PtaTreeDataProvider({} as never);
    });

    afterEach(() => {
        explorerNodeManager.clearCache();
    });

    it("根节点（题集）应返回 undefined", () => {
        const set = new PtaNode(
            createDefaultPtaNode({
                psID: "ps1",
                label: "期末考核",
                type: PtaNodeType.ProblemSet,
                value: { problemSet: "期末考核" },
            })
        );

        assert.strictEqual(provider.getParent(set), undefined);
    });

    it("题目节点应还原到所属题集", async () => {
        const problem = new PtaNode(
            createDefaultPtaNode({
                psID: "ps1",
                pID: "p1",
                type: PtaNodeType.Problem,
                value: {
                    problemSet: "期末考核",
                    problemType: ProblemType.PROGRAMMING,
                    parentType: PtaNodeType.ProblemSet,
                },
            })
        );

        const parent = (await provider.getParent(problem)) as PtaNode;

        assert.strictEqual(parent.type, PtaNodeType.ProblemSet);
        assert.strictEqual(parent.psID, "ps1");
        assert.strictEqual(parent.label, "期末考核");
    });
});
