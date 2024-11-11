import * as fs from "fs-extra";
import * as vscode from 'vscode';
import { codeLensController } from './codelens/CodeLensController';
import * as cache from "./commands/cache";
import * as language from "./commands/language";
import * as show from "./commands/show";
import * as submit from "./commands/submit";
import * as user from "./commands/user";
import * as workspace from "./commands/workspace";
import * as star from "./commands/star";
import { explorerController } from "./explorer/explorerController";
import { PtaNode } from "./explorer/PtaNode";
import { favoritesTreeDataProvider } from "./favorites/favoritesTreeDataProvider";
import { ptaChannel } from './ptaChannel';
import { ptaExecutor } from './ptaExecutor';
import { ptaManager } from './ptaManager';
import { configPath, IPtaCode, UserStatus } from './shared';
import { ptaStatusBarController } from './statusbar/ptaStatusBarController';
import { ptaLoginProvider } from './webview/ptaLoginProvider';
import { ptaPreviewProvider } from './webview/ptaPreviewProvider';
import { ptaSubmissionProvider } from './webview/ptaSubmissionProvider';
import { ptaTestProvider } from './webview/ptaTestProvider';
import { favoriteProblemsManager } from "./favorites/favoriteProblemsManager";


let globalContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
	globalContext = context;

	ptaManager.on("statusChanged", () => {
		const userStatus: UserStatus = ptaManager.getStatus();
		if (userStatus === UserStatus.SignedIn) {
			vscode.commands.executeCommand('setContext', 'pintia.showWelcome', false);
			explorerController.createTreeView(context);
		} else {
			explorerController.dispose();
			vscode.commands.executeCommand('setContext', 'pintia.showWelcome', true);
		}
		favoritesTreeDataProvider.refresh();
		ptaStatusBarController.updateStatusBar(ptaManager.getUserSession());
	});

	context.subscriptions.push(
		ptaPreviewProvider,
		ptaLoginProvider,
		ptaSubmissionProvider,
		ptaStatusBarController,
		ptaTestProvider,
		codeLensController,
		ptaExecutor,
		ptaChannel,
		explorerController,
		favoriteProblemsManager,
		vscode.window.createTreeView("pintiaMyFavorites", { treeDataProvider: favoritesTreeDataProvider, showCollapseAll: true }),
		vscode.commands.registerCommand("pintia.openPintiaHome", () => user.openPintiaHome()),
		vscode.commands.registerCommand("pintia.openExtensionRepo", () => user.openExtensionRepo()),
		vscode.commands.registerCommand("pintia.refreshExplorer", () => explorerController.refreshTreeData()),
		vscode.commands.registerCommand("pintia.clearCache", () => cache.clearCache()),
		vscode.commands.registerCommand("pintia.signIn", () => ptaManager.signIn()),
		vscode.commands.registerCommand("pintia.signOut", () => ptaManager.signOut()),
		vscode.commands.registerCommand("pintia.previewProblem", (psID: string, pID: string) => ptaPreviewProvider.showPreview(psID, pID)),
		vscode.commands.registerCommand("pintia.manageUser", () => user.showUserManager()),
		vscode.commands.registerCommand("pintia.checkIn", () => user.checkInPTA()),
		vscode.commands.registerCommand("pintia.reportIssue", () => user.reportIssue()),
		vscode.commands.registerCommand("pintia.searchProblem", () => show.searchProblem()),
		vscode.commands.registerCommand("pintia.refreshProblemSearchIndex", () => cache.refreshProblemSearchIndex()),
		vscode.commands.registerCommand("pintia.codeProblem", (ptaCode: IPtaCode) => show.showCodingEditor(ptaCode)),
		vscode.commands.registerCommand("pintia.testCustomSample", (ptaCode: IPtaCode, index: number) => submit.testCustomSample(ptaCode, index)),
		vscode.commands.registerCommand("pintia.submitSolution", (ptaCode: IPtaCode) => submit.submitSolution(ptaCode)),
		vscode.commands.registerCommand("pintia.testSolution", (ptaCode: IPtaCode) => submit.testSolution(ptaCode)),
		vscode.commands.registerCommand("pintia.changeDefaultLanguage", () => language.changeDefaultLanguage()),
		vscode.commands.registerCommand("pintia.changeWorkspaceFolder", () => workspace.changeWorkspaceFolder()),
		vscode.commands.registerCommand("pintia.openWorkspace", () => workspace.openWorkspace()),
		vscode.commands.registerCommand("pintia.welcome", () => {
			vscode.commands.executeCommand(`workbench.action.openWalkthrough`, `jinzcdev.vscode-pintia#pintia`, false);
		}),
		vscode.commands.registerCommand("pintia.addFavorite", (ptaNode: PtaNode) => star.addFavoriteProblem(ptaNode)),
		vscode.commands.registerCommand("pintia.removeFavorite", (ptaNode: PtaNode) => star.removeFavoriteProblem(ptaNode))
	);

	await fs.mkdirs(configPath);
	await ptaManager.fetchLoginStatus();

	user.autoCheckInPTA();

	await cache.createProblemSearchIndex(context);
}

export function getGlobalContext(): vscode.ExtensionContext {
	return globalContext;
}

export function deactivate() { }
