import * as vscode from "vscode";
import { Disposable } from "vscode";
import { PtaNode } from "./PtaNode";
import { PtaTreeDataProvider } from "./PtaTreeDataProvider";

class ExplorerController<T> implements Disposable {
    private treeView?: vscode.TreeView<T>;
    private ptaTreeDataProvider?: PtaTreeDataProvider;
    /**
     * 是否已注册进 `context.subscriptions`。
     *
     * 登出会 dispose 掉 treeView，再次登录又会走到这里；不加这个标记，
     * 每轮「登出→登录」都会往 subscriptions 里再塞一个同一个对象。
     */
    private registered = false;

    public createTreeView(context: vscode.ExtensionContext) {
        if (!this.treeView) {
            this.ptaTreeDataProvider = new PtaTreeDataProvider(context);
            this.treeView = vscode.window.createTreeView("pintiaExplorer", {
                treeDataProvider: this.ptaTreeDataProvider,
                showCollapseAll: true,
            });
            if (!this.registered) {
                context.subscriptions.push(this);
                this.registered = true;
            }
        }
    }

    public async refreshTreeData() {
        this.ptaTreeDataProvider?.refresh();
    }

    public dispose() {
        this.treeView?.dispose();
        this.ptaTreeDataProvider?.dispose();
        this.treeView = undefined;
        this.ptaTreeDataProvider = undefined;
    }
}

export const explorerController: ExplorerController<PtaNode> = new ExplorerController();
