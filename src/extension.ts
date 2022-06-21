import * as vscode from 'vscode';
import { pintiaTreeDataProvider } from './explorer/PtaTreeDataProvider';
import { ptaManager } from './PtaManager';
import { PtaNode } from './explorer/PtaNode';
import { ptaApi } from './api';
import { ProblemType } from './shared';

export function activate(context: vscode.ExtensionContext) {

	ptaManager.on("statusChanged", () => {
		vscode.window.showInformationMessage("statusChanged!");
		pintiaTreeDataProvider.refresh();
	});

	pintiaTreeDataProvider.initialize(context);

	context.subscriptions.push(
		vscode.commands.registerCommand("pintia.signin", () => { ptaManager.signIn().catch(val => vscode.window.showInformationMessage(val)); }),
		vscode.commands.registerCommand("pintia.previewProblem", (problem: PtaNode) => {

		}),
		vscode.window.createTreeView("pintiaExplorer", { treeDataProvider: pintiaTreeDataProvider, showCollapseAll: false }),
	);
}

export function deactivate() { }
