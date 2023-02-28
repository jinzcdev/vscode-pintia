
import * as vscode from "vscode";
import { ptaManager } from "../PtaManager";
import { IFavoriteProblem } from "./IFavoriteProblem";
import { favoriteProblemsManager } from "./favoriteProblemsManager";


export class FavoritesTreeDataProvider implements vscode.TreeDataProvider<IFavoriteProblem>, vscode.Disposable {

    private onDidChangeTreeDataEvent: vscode.EventEmitter<IFavoriteProblem | undefined | null> = new vscode.EventEmitter<IFavoriteProblem | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    getTreeItem(element: IFavoriteProblem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.pID === "-1") {
            return {
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None
            };
        }
        return {
            label: element.title,
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

    getChildren(element?: IFavoriteProblem): vscode.ProviderResult<IFavoriteProblem[]> {

        if (!ptaManager.getUserSession()) {
            return [{ pID: "-1", psID: "-1", psName: "", title: "" }];
        }
        if (!element) {
            // root directory
            return favoriteProblemsManager.getFavoriteProblems(favoriteProblemsManager.getCurrentUserId());
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