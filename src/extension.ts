import * as fs from "fs-extra";
import * as vscode from 'vscode';
import { codeLensController } from './codelens/CodeLensController';
import * as cache from "./commands/cache";
import * as language from "./commands/language";
import * as show from "./commands/show";
import * as submit from "./commands/submit";
import * as user from "./commands/user";
import * as workspace from "./commands/workspace";
import { ptaTreeDataProvider } from './explorer/ptaTreeDataProvider';
import { ptaChannel } from './ptaChannel';
import { ptaExecutor } from './PtaExecutor';
import { ptaManager } from './PtaManager';
import { configPath, IPtaCode } from './shared';
import { ptaStatusBarController } from './statusbar/ptaStatusBarController';
import { ptaLoginProvider } from './webview/ptaLoginProvider';
import { ptaPreviewProvider } from './webview/ptaPreviewProvider';
import { ptaSubmissionProvider } from './webview/ptaSubmissionProvider';
import { ptaTestProvider } from './webview/ptaTestProvider';


export async function activate(context: vscode.ExtensionContext) {

	ptaManager.on("statusChanged", () => {
		ptaTreeDataProvider.refresh();
		ptaStatusBarController.updateStatusBar(ptaManager.getUserSession());
	});

	ptaTreeDataProvider.initialize(context);

	context.subscriptions.push(
		ptaPreviewProvider,
		ptaLoginProvider,
		ptaSubmissionProvider,
		ptaStatusBarController,
		ptaTestProvider,
		codeLensController,
		ptaExecutor,
		ptaChannel,
		vscode.commands.registerCommand("pintia.openPintiaHome", () => user.openPintiaHome()),
		vscode.commands.registerCommand("pintia.openExtensionRepo", () => user.openExtensionRepo()),
		vscode.commands.registerCommand("pintia.refreshExplorer", () => ptaTreeDataProvider.refresh()),
		vscode.commands.registerCommand("pintia.clearCache", () => cache.clearCache()),
		vscode.commands.registerCommand("pintia.signIn", () => ptaManager.signIn()),
		vscode.commands.registerCommand("pintia.signOut", () => ptaManager.signOut()),
		vscode.commands.registerCommand("pintia.previewProblem", async (psID: string, pID: string) => await ptaPreviewProvider.showPreview(psID, pID)),
		vscode.commands.registerCommand("pintia.manageUser", () => user.showUserManager()),
		vscode.commands.registerCommand("pintia.checkIn", () => user.checkInPTA()),
		vscode.commands.registerCommand("pintia.reportIssue", () => user.reportIssue()),
		vscode.commands.registerCommand("pintia.searchProblem", () => show.searchProblem()),
		vscode.commands.registerCommand("pintia.refreshProblemSearchIndex", () => cache.refreshProblemSearchIndex()),
		vscode.commands.registerCommand("pintia.codeProblem", async (ptaCode: IPtaCode) => await show.showCodingEditor(ptaCode)),
		vscode.commands.registerCommand("pintia.testCustomSample", (ptaCode: IPtaCode, index: number) => submit.testCustomSample(ptaCode, index)),
		vscode.commands.registerCommand("pintia.submitSolution", (ptaCode: IPtaCode) => submit.submitSolution(ptaCode)),
		vscode.commands.registerCommand("pintia.testSolution", (ptaCode: IPtaCode) => submit.testSolution(ptaCode)),
		vscode.commands.registerCommand("pintia.changeDefaultLanguage", () => language.changeDefaultLanguage()),
		vscode.commands.registerCommand("pintia.changeWorkspaceFolder", () => workspace.changeWorkspaceFolder()),
		vscode.window.createTreeView("pintiaExplorer", { treeDataProvider: ptaTreeDataProvider, showCollapseAll: true })
	);

	await fs.mkdirs(configPath);
	await ptaManager.fetchLoginStatus();

	user.autoCheckInPTA();

	await cache.createProblemSearchIndex(context);
}

export function deactivate() { }
