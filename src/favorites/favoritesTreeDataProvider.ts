
import * as vscode from "vscode";
import { ptaManager } from "../ptaManager";
import { ProblemBasicInfo } from "../entity/ProblemBasicInfo";
import { favoriteProblemsManager } from "./favoriteProblemsManager";


export class FavoritesTreeDataProvider implements vscode.TreeDataProvider<ProblemBasicInfo>, vscode.Disposable {

    private onDidChangeTreeDataEvent: vscode.EventEmitter<ProblemBasicInfo | undefined | null> = new vscode.EventEmitter<ProblemBasicInfo | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    getTreeItem(element: ProblemBasicInfo): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (!element) {
            return {
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None
            };
        }
        return {
            label: element.displayTitle ?? "",
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

    getChildren(element?: ProblemBasicInfo): vscode.ProviderResult<ProblemBasicInfo[]> {
        if (!ptaManager.getUserSession()) {
            return null;
        }
        if (!element) {
            // root directory
            const favoriteProblems = favoriteProblemsManager.getFavoriteProblems(favoriteProblemsManager.getCurrentUserId());
            const modifiedProblems = favoriteProblems.map((problem, index) => ({
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

export const favoritesTreeDataProvider = new FavoritesTreeDataProvider();