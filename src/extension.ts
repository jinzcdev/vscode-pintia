import * as fs from "fs-extra";
import * as vscode from 'vscode';
import { codeLensController } from './codelens/CodeLensController';
import * as cache from "./commands/cache";
import * as language from "./commands/language";
import * as show from "./commands/show";
import * as star from "./commands/star";
import * as submit from "./commands/submit";
import * as user from "./commands/user";
import * as workspace from "./commands/workspace";
import { explorerController } from "./explorer/explorerController";
import { PtaNode } from "./explorer/PtaNode";
import { favoriteProblemsManager } from "./favorites/favoriteProblemsManager";
import { favoritesTreeDataProvider } from "./favorites/favoritesTreeDataProvider";
import { ptaChannel } from './ptaChannel';
import { ptaExecutor } from './ptaExecutor';
import { ptaManager } from './ptaManager';
import { configPath, IPtaCode, UserStatus } from './shared';
import { ptaStatusBarController } from './statusbar/ptaStatusBarController';
import { PtaPreviewProvider } from './webview/PtaPreviewProvider';
import { ProblemView } from "./webview/views/ProblemView";
import { historyTreeDataProvider } from "./view-history/historyTreeDataProvider";
import { historyManager } from "./view-history/historyManager";
import { ptaConfig } from "./ptaConfig";
import { PtaSubmissionProvider } from "./webview/PtaSubmissionProvider";
import { ptaApi } from "./utils/api";


let globalContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
	globalContext = context;

	ptaManager.on("statusChanged", async () => {
		const userStatus: UserStatus = ptaManager.getStatus();
		if (userStatus === UserStatus.SignedIn) {
			vscode.commands.executeCommand('setContext', 'pintia.showWelcome', false);
			explorerController.createTreeView(context);
		} else {
			explorerController.dispose();
			vscode.commands.executeCommand('setContext', 'pintia.showWelcome', true);
		}
		Promise.all([historyTreeDataProvider.refresh(), favoritesTreeDataProvider.refresh()]);
		ptaStatusBarController.updateStatusBar(ptaManager.getUserSession());
	});

	await fs.mkdirs(configPath).then(() => {
		Promise.all([
			ptaManager.fetchLoginStatus(),
			cache.createProblemSearchIndex(context)
		]);
	});

	context.subscriptions.push(
		ptaStatusBarController,
		codeLensController,
		ptaExecutor,
		ptaChannel,
		explorerController,
		favoriteProblemsManager,
		historyManager,
		vscode.window.createTreeView("pintiaProblemHistory", { treeDataProvider: historyTreeDataProvider, showCollapseAll: true }),
		vscode.window.createTreeView("pintiaMyFavorites", { treeDataProvider: favoritesTreeDataProvider, showCollapseAll: true }),
		vscode.commands.registerCommand("pintia.openPintiaHome", () => user.openPintiaHome()),
		vscode.commands.registerCommand("pintia.openExtensionRepo", () => user.openExtensionRepo()),
		vscode.commands.registerCommand("pintia.refreshExplorer", () => explorerController.refreshTreeData()),
		vscode.commands.registerCommand("pintia.clearCache", () => cache.clearCache()),
		vscode.commands.registerCommand("pintia.signIn", () => ptaManager.signIn()),
		vscode.commands.registerCommand("pintia.signOut", () => ptaManager.signOut()),
		vscode.commands.registerCommand("pintia.previewProblem", async (psID: string, pID: string, codeIt: boolean = true) => {
			const problem = await new ProblemView(psID, pID).fetch();
			await PtaPreviewProvider.createOrUpdate(problem).show().then(() => {
				historyManager.addProblem(historyManager.getCurrentUserId(), {
					pID: problem.id,
					psID: problem.problemSetId,
					psName: problem.problemSetName,
					title: `${problem.label} ${problem.title}`
				});
				historyTreeDataProvider.refresh();
				if (codeIt && ptaConfig.getPreviewProblemAndCodeIt()) {
					show.showCodingEditor(ProblemView.toPtaNode(problem));
				}
			});
		}),
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
		vscode.commands.registerCommand("pintia.removeFavorite", (ptaNode: PtaNode) => star.removeFavoriteProblem(ptaNode.pID)),
		vscode.commands.registerCommand("pintia.clearViewedProblems", () => historyManager.clearViewedProblems()),
		vscode.commands.registerCommand("pintia.clearFavoriteProblems", () => favoriteProblemsManager.clearFavoriteProblems()),
		vscode.commands.registerCommand("pintia.checkLastSubmission", async (ptaCode: IPtaCode) => {
			const cookie = ptaManager.getUserSession()?.cookie ?? "";
			const submissionId = (await ptaApi.getLastSubmissions(ptaCode.psID, ptaCode.pID, cookie))?.id;
			if (submissionId) {
				const data = await ptaApi.getProblemSubmissionResult(submissionId, cookie);
				if (data && data.queued === -1 && data.submission.status !== "WAITING" && data.submission.status !== "JUDGING") {
					PtaSubmissionProvider.createOrUpdate(data).show();
				}
			}
		})
	);
}

export function getGlobalContext(): vscode.ExtensionContext {
	return globalContext;
}

export function deactivate() { }
