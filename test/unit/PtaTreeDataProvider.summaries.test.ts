import * as assert from "assert";
import * as sinon from "sinon";
import { PtaTreeDataProvider } from "../../src/explorer/PtaTreeDataProvider";
import { PtaNode } from "../../src/explorer/PtaNode";
import { explorerNodeManager } from "../../src/explorer/explorerNodeManager";
import { defaultPtaNode, PtaNodeType } from "../../src/shared";
import { ptaApi } from "../../src/utils/api";
import { ptaManager } from "../../src/ptaManager";
import { ptaConfig } from "../../src/ptaConfig";

describe("PtaTreeDataProvider - summaries 懒加载", () => {
    let provider: PtaTreeDataProvider;
    let getSummaryStub: sinon.SinonStub;

    beforeEach(() => {
        provider = new PtaTreeDataProvider({} as never);
        getSummaryStub = sinon.stub(ptaApi, "getProblemSummary");
        sinon.stub(ptaManager, "getUserSession").returns({ cookie: "cookie=test" } as never);
        sinon.stub(ptaConfig, "getPageSize").returns(100);
    });

    afterEach(() => {
        sinon.restore();
    });

    /** 构造带指定 summaries 的题集节点 */
    function createProblemSetNode(summaries: Record<string, unknown> | undefined): PtaNode {
        return new PtaNode({
            ...defaultPtaNode,
            psID: "2048056131767074816",
            label: "期末考核",
            type: PtaNodeType.ProblemSet,
            value: {
                ...defaultPtaNode.value,
                problemSet: "期末考核",
                summaries: summaries as never,
            },
        });
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
});
