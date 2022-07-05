import * as vscode from 'vscode';
import { pintiaTreeDataProvider } from './explorer/ptaTreeDataProvider';
import { ptaManager } from './PtaManager';
import { PtaNode } from './explorer/PtaNode';
import { ptaPreviewProvider } from './webview/ptaPreviewProvider';
import { ptaStatusBarController } from './statusbar/ptaStatusBarController';

export async function activate(context: vscode.ExtensionContext) {

	ptaManager.on("statusChanged", () => {
		// vscode.window.showInformationMessage("statusChanged!");
		pintiaTreeDataProvider.refresh();
		ptaStatusBarController.updateStatusBar(ptaManager.getStatus(), ptaManager.getUser());
	});

	pintiaTreeDataProvider.initialize(context);

	context.subscriptions.push(
		ptaPreviewProvider,
		vscode.commands.registerCommand("pintia.signIn", () => ptaManager.signIn().catch(val => vscode.window.showInformationMessage(val))),
		vscode.commands.registerCommand("pintia.signOut", () => ptaManager.signOut()),
		vscode.commands.registerCommand("pintia.previewProblem", async (node: PtaNode) => ptaPreviewProvider.showPreview(node)),
		vscode.window.createTreeView("pintiaExplorer", { treeDataProvider: pintiaTreeDataProvider, showCollapseAll: false }),
	);

	await ptaManager.getLoginStatus();
}

export function deactivate() { }
