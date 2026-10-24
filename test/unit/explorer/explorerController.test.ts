import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { explorerController } from "../../../src/explorer/explorerController";
import { PtaNode } from "../../../src/explorer/PtaNode";
import { PtaTreeDataProvider } from "../../../src/explorer/PtaTreeDataProvider";
import { ptaConfig } from "../../../src/ptaConfig";
import { createDefaultPtaNode, ProblemType, PtaNodeType } from "../../../src/shared";
import { resetVscodeMock } from "../../setup";

/** 只实现被测代码所需字段的 ExtensionContext */
function createFakeContext(): vscode.ExtensionContext {
    return { subscriptions: [] } as unknown as vscode.ExtensionContext;
}

describe("explorerController - 生命周期", () => {
    beforeEach(() => {
        resetVscodeMock();
        explorerController.dispose();
    });

    afterEach(() => {
        explorerController.dispose();
        resetVscodeMock();
    });

    it("重复 createTreeView 只应注册一次 disposable", () => {
        // 回归：登出会 dispose 掉 treeView，再次登录又走到 createTreeView，
        // 此前每轮都会往 subscriptions 里再塞一个同一个对象
        const context = createFakeContext();

        explorerController.createTreeView(context);
        explorerController.dispose();
        explorerController.createTreeView(context);

        assert.strictEqual(context.subscriptions.length, 1);
    });

    it("重复调用 createTreeView 不应重建视图", () => {
        const context = createFakeContext();

        explorerController.createTreeView(context);
        explorerController.createTreeView(context);

        assert.strictEqual((vscode.window.createTreeView as sinon.SinonStub).callCount, 1);
    });

    it("dispose 后应能重新创建", () => {
        const context = createFakeContext();

        explorerController.createTreeView(context);
        explorerController.dispose();
        explorerController.createTreeView(context);

        assert.strictEqual((vscode.window.createTreeView as sinon.SinonStub).callCount, 2);
    });

    it("未创建时 dispose 与 refresh 都不应抛错", async () => {
        assert.doesNotThrow(() => explorerController.dispose());
        await assert.doesNotReject(() => explorerController.refreshTreeData());
    });
});

interface TreeViewMock {
    reveal: sinon.SinonStub;
    visible: boolean;
    onDidChangeVisibility: sinon.SinonStub;
    dispose: sinon.SinonStub;
}

describe("explorerController - 打开题目时定位树节点", () => {
    let clock: sinon.SinonFakeTimers;
    let treeView: TreeViewMock;
    let provider: PtaTreeDataProvider;
    let locateStub: sinon.SinonStub;

    const setNode = new PtaNode(
        createDefaultPtaNode({
            psID: "ps1",
            label: "期末考核",
            type: PtaNodeType.ProblemSet,
            value: { problemSet: "期末考核" },
        })
    );
    const page0 = new PtaNode(
        createDefaultPtaNode({
            psID: "ps1",
            type: PtaNodeType.ProblemPage,
            label: "1-100",
            value: {
                problemSet: "期末考核",
                problemType: ProblemType.PROGRAMMING,
                page: 0,
                limit: 100,
                total: 150,
                parentType: PtaNodeType.ProblemSet,
            },
        })
    );
    const page1 = new PtaNode(
        createDefaultPtaNode({
            psID: "ps1",
            type: PtaNodeType.ProblemPage,
            label: "101-150",
            value: {
                problemSet: "期末考核",
                problemType: ProblemType.PROGRAMMING,
                page: 1,
                limit: 100,
                total: 150,
                parentType: PtaNodeType.ProblemSet,
            },
        })
    );

    function problem(pID: string, index: number): PtaNode {
        return new PtaNode(
            createDefaultPtaNode({
                psID: "ps1",
                pID,
                type: PtaNodeType.Problem,
                label: `[${index}] ${pID}`,
                value: {
                    problemSet: "期末考核",
                    problemType: ProblemType.PROGRAMMING,
                    parentType: PtaNodeType.ProblemPage,
                    parentPage: index > 100 ? 1 : 0,
                    pageParentType: PtaNodeType.ProblemSet,
                    total: 150,
                    limit: 100,
                },
            })
        );
    }

    const p1 = problem("p1", 120);
    const p2 = problem("p2", 130);

    beforeEach(() => {
        resetVscodeMock();
        explorerController.dispose();
        clock = sinon.useFakeTimers();
        explorerController.createTreeView(createFakeContext());

        const stub = vscode.window.createTreeView as sinon.SinonStub;
        treeView = stub.lastCall.returnValue as TreeViewMock;
        provider = stub.lastCall.args[1].treeDataProvider as PtaTreeDataProvider;

        sinon.stub(ptaConfig, "getPageSize").returns(100);
        locateStub = sinon.stub(explorerController as any, "locateInSearchIndex");
    });

    afterEach(() => {
        explorerController.dispose();
        clock.restore();
        sinon.restore();
        resetVscodeMock();
    });

    it("索引命中时应按题型/页码定位并 reveal", async () => {
        locateStub.returns({ problemType: ProblemType.PROGRAMMING, indexInType: 120 });
        sinon.stub(provider, "getChildren").callsFake(async (element?: PtaNode) => {
            if (!element) return [setNode];
            if (element === setNode) return [page0, page1];
            if (element === page1) return [p1];
            return [];
        });

        await explorerController.revealProblem("ps1", "p1");

        assert.strictEqual(treeView.reveal.calledOnce, true);
        assert.strictEqual(treeView.reveal.firstCall.args[0], p1);
        assert.deepStrictEqual(treeView.reveal.firstCall.args[1], {
            select: true,
            focus: false,
            expand: true,
        });
    });

    it("索引缺失时应回退为逐层扫描", async () => {
        locateStub.returns(undefined);
        sinon.stub(provider, "getChildren").callsFake(async (element?: PtaNode) => {
            if (!element) return [setNode];
            if (element === setNode) return [page0, page1];
            if (element === page0) return [];
            if (element === page1) return [p1];
            return [];
        });

        await explorerController.revealProblem("ps1", "p1");

        assert.strictEqual(treeView.reveal.calledOnce, true);
        assert.strictEqual(treeView.reveal.firstCall.args[0], p1);
    });

    it("索引页码不匹配时应回退扫描找到真实位置", async () => {
        // 索引说在 page 1，但实际 p1 在 page 0
        locateStub.returns({ problemType: ProblemType.PROGRAMMING, indexInType: 120 });
        sinon.stub(provider, "getChildren").callsFake(async (element?: PtaNode) => {
            if (!element) return [setNode];
            if (element === setNode) return [page0, page1];
            if (element === page0) return [p1];
            if (element === page1) return [];
            return [];
        });

        await explorerController.revealProblem("ps1", "p1");

        assert.strictEqual(treeView.reveal.calledOnce, true);
        assert.strictEqual(treeView.reveal.firstCall.args[0], p1);
    });

    it("视图不可见时不请求，展开视图后才定位", async () => {
        treeView.visible = false;
        locateStub.returns({ problemType: ProblemType.PROGRAMMING, indexInType: 120 });
        sinon.stub(provider, "getChildren").callsFake(async (element?: PtaNode) => {
            if (!element) return [setNode];
            if (element === setNode) return [page0, page1];
            if (element === page1) return [p1];
            return [];
        });

        explorerController.scheduleRevealProblem("ps1", "p1");
        await clock.tickAsync(300);
        assert.strictEqual(treeView.reveal.called, false);

        treeView.visible = true;
        const listener = treeView.onDidChangeVisibility.firstCall.args[0] as () => void;
        listener();
        await clock.tickAsync(0);

        assert.strictEqual(treeView.reveal.calledOnce, true);
        assert.strictEqual(treeView.reveal.firstCall.args[0], p1);
    });

    it("快速切换文件时只定位最后一题", async () => {
        locateStub.callsFake((_psID: string, pID: string) => ({
            problemType: ProblemType.PROGRAMMING,
            indexInType: pID === "p1" ? 120 : 130,
        }));
        sinon.stub(provider, "getChildren").callsFake(async (element?: PtaNode) => {
            if (!element) return [setNode];
            if (element === setNode) return [page0, page1];
            if (element === page1) return [p1, p2];
            return [];
        });

        explorerController.scheduleRevealProblem("ps1", "p1");
        explorerController.scheduleRevealProblem("ps1", "p2");
        await clock.tickAsync(300);

        assert.strictEqual(treeView.reveal.calledOnce, true);
        assert.strictEqual(treeView.reveal.firstCall.args[0], p2);
    });

    it("题集不在根节点中时应静默放弃", async () => {
        locateStub.returns(undefined);
        sinon.stub(provider, "getChildren").resolves([]);

        await explorerController.revealProblem("ps1", "p1");

        assert.strictEqual(treeView.reveal.called, false);
    });

    it("dispose 应取消尚未执行的定位", async () => {
        explorerController.scheduleRevealProblem("ps1", "p1");
        explorerController.dispose();
        await clock.tickAsync(300);

        assert.strictEqual(treeView.reveal.called, false);
    });
});
