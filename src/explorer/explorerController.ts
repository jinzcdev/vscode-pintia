import * as vscode from "vscode";
import { Disposable } from "vscode";
import { PtaNode } from "./PtaNode";
import { PtaTreeDataProvider } from "./PtaTreeDataProvider";

class ExplorerController<T> implements Disposable {

    private treeView?: vscode.TreeView<T>;
    private ptaTreeDataProvider?: PtaTreeDataProvider;


    public createTreeView(context: vscode.ExtensionContext) {
        if (!this.treeView) {
            this.ptaTreeDataProvider = new PtaTreeDataProvider(context);
            this.treeView = vscode.window.createTreeView("pintiaExplorer", {
                treeDataProvider: this.ptaTreeDataProvider,
                showCollapseAll: true
            });
            context.subscriptions.push(this);
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