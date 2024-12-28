
import * as vscode from "vscode";
import { ProblemBasicInfo } from "../entity/ProblemBasicInfo";
import { favoriteProblemsManager } from "../favorites/favoriteProblemsManager";
import { ptaManager } from "../ptaManager";
import { historyManager } from "./historyManager";


export class HistoryTreeDataProvider implements vscode.TreeDataProvider<ProblemBasicInfo>, vscode.Disposable {

    private onDidChangeTreeDataEvent: vscode.EventEmitter<ProblemBasicInfo | undefined | null> = new vscode.EventEmitter<ProblemBasicInfo | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    getTreeItem(element: ProblemBasicInfo): vscode.TreeItem | Thenable<vscode.TreeItem> {
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

    getChildren(element?: ProblemBasicInfo): vscode.ProviderResult<ProblemBasicInfo[]> {
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