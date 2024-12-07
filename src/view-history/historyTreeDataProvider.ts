
import * as vscode from "vscode";
import { ptaManager } from "../ptaManager";
import { HistoryProblem } from "./HistoryProblem";
import { historyManager } from "./historyManager";
import { favoriteProblemsManager } from "../favorites/favoriteProblemsManager";


export class HistoryTreeDataProvider implements vscode.TreeDataProvider<HistoryProblem>, vscode.Disposable {

    private onDidChangeTreeDataEvent: vscode.EventEmitter<HistoryProblem | undefined | null> = new vscode.EventEmitter<HistoryProblem | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    getTreeItem(element: HistoryProblem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (!element) {
            return {
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None
            };
        }
        const contextValue = favoriteProblemsManager.isFavoriteProblem(historyManager.getCurrentUserId(), element.pID) ? "problem-favorite" : "problem";
        return {
            label: element.displayTitle ?? "",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                title: "Preview Problem",
                command: "pintia.previewProblem",
                arguments: [element.psID, element.pID]
            },
            tooltip: element.psName,
            contextValue: contextValue
        };
    }

    getChildren(element?: HistoryProblem): vscode.ProviderResult<HistoryProblem[]> {
        if (!ptaManager.getUserSession()) {
            return null;
        }
        if (!element) {
            // root directory
            const problems = historyManager.getProblemHistory(historyManager.getCurrentUserId());
            const modifiedProblems = problems.map((problem, index) => ({
                ...problem,
                displayTitle: `[${index + 1}] ${problem.title}`
            }));
            return modifiedProblems;
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