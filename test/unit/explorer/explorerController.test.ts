import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { explorerController } from "../../../src/explorer/explorerController";
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
