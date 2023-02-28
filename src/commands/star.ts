import { explorerController } from "../explorer/explorerController";
import { PtaNode } from "../explorer/PtaNode";
import { favoriteProblemsManager } from "../favorites/favoriteProblemsManager";
import { favoritesTreeDataProvider } from "../favorites/favoritesTreeDataProvider";

export async function addFavoriteProblem(ptaNode: PtaNode) {
    favoriteProblemsManager.addFavoriteProblem(favoriteProblemsManager.getCurrentUserId(), {
        pID: ptaNode.pID,
        psID: ptaNode.psID,
        psName: ptaNode.value.problemSet,
        title: ptaNode.title
    });
    await favoritesTreeDataProvider.refresh();
    await explorerController.refreshTreeData();
}

export async function removeFavoriteProblem(ptaNode: PtaNode) {
    favoriteProblemsManager.removeFavoriteProblem(favoriteProblemsManager.getCurrentUserId(), ptaNode.pID);
    await favoritesTreeDataProvider.refresh();
    await explorerController.refreshTreeData();
}