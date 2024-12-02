
import * as vscode from "vscode";
import { ptaManager } from "../ptaManager";
import { HistoryProblem } from "./HistoryProblem";
import { historyManager } from "./historyManager";


export class HistoryTreeDataProvider implements vscode.TreeDataProvider<HistoryProblem>, vscode.Disposable {

    private onDidChangeTreeDataEvent: vscode.EventEmitter<HistoryProblem | undefined | null> = new vscode.EventEmitter<HistoryProblem | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    getTreeItem(element: HistoryProblem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.pID === "-1") {
            return {
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None
            };
        }
        return {
            label: `${element.label} ${element.title}`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                title: "Preview Problem",
                command: "pintia.previewProblem",
                arguments: [element.psID, element.pID]
            },
            tooltip: element.psName,
            contextValue: "problem-favorite"
        };
    }

    getChildren(element?: HistoryProblem): vscode.ProviderResult<HistoryProblem[]> {

        if (!ptaManager.getUserSession()) {
            return [{ pID: "-1", psID: "-1", psName: "", label: "", title: "" }];
        }
        if (!element) {
            // root directory
            return historyManager.getProblemHistory(historyManager.getCurrentUserId());
        }

        return null;
    }

    public async refresh() {
        this.onDidChangeTreeDataEvent.fire(null);
    }

    public dispose() {
        this.onDidChangeTreeDataEvent.dispose();
    }

}

export const historyTreeDataProvider = new HistoryTreeDataProvider();