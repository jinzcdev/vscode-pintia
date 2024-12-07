import { explorerController } from "../explorer/explorerController";
import { PtaNode } from "../explorer/PtaNode";
import { favoriteProblemsManager } from "../favorites/favoriteProblemsManager";
import { favoritesTreeDataProvider } from "../favorites/favoritesTreeDataProvider";
import { IFavoriteProblem } from "../favorites/IFavoriteProblem";
import { historyTreeDataProvider } from "../view-history/historyTreeDataProvider";

export async function addFavoriteProblem(problem: PtaNode | IFavoriteProblem) {
    favoriteProblemsManager.addFavoriteProblem(favoriteProblemsManager.getCurrentUserId(), {
        pID: problem.pID,
        psID: problem.psID,
        psName: problem instanceof PtaNode ? problem.value.problemSet : problem.psName,
        title: problem.title
    });
    await Promise.all([
        favoritesTreeDataProvider.refresh(),
        historyTreeDataProvider.refresh(),
        explorerController.refreshTreeData()
    ]);
}

export async function removeFavoriteProblem(pID: string) {
    favoriteProblemsManager.removeFavoriteProblem(favoriteProblemsManager.getCurrentUserId(), pID);
    await Promise.all([
        favoritesTreeDataProvider.refresh(),
        historyTreeDataProvider.refresh(),
        explorerController.refreshTreeData()
    ]);
}