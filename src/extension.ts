import * as vscode from 'vscode';
import { pintiaTreeDataProvider } from './explorer/ptaTreeDataProvider';
import { ptaManager } from './PtaManager';
import { PtaNode } from './explorer/PtaNode';
import { ptaPreviewProvider } from './webview/ptaPreviewProvider';
import { ptaStatusBarController } from './statusbar/ptaStatusBarController';
import * as user from "./commands/user";
import * as submit from "./commands/submit";
import { ptaSubmissionProvider } from './webview/ptaSubmissionProvider';
import { selectWorkspaceFolder } from './utils/workspaceUtils';
import { codeLensController } from './codelens/CodeLensController';
import { ptaConfig } from './ptaConfig';

export async function activate(context: vscode.ExtensionContext) {

	ptaManager.on("statusChanged", () => {
		// vscode.window.showInformationMessage("statusChanged!");
		pintiaTreeDataProvider.refresh();
		ptaStatusBarController.updateStatusBar(ptaManager.getUserSession());
	});

	pintiaTreeDataProvider.initialize(context);
	console.log(ptaConfig.getEditorShortcuts());

	context.subscriptions.push(
		ptaPreviewProvider,
		ptaStatusBarController,
		codeLensController,
		vscode.commands.registerCommand("pintia.signIn", () => ptaManager.signIn().catch(val => vscode.window.showInformationMessage(val))),
		vscode.commands.registerCommand("pintia.signOut", () => ptaManager.signOut()),
		vscode.commands.registerCommand("pintia.previewProblem", async (node: PtaNode) => ptaPreviewProvider.showPreview(node)),
		vscode.commands.registerCommand("pintia.manageUser", () => user.showUserManager()),
		vscode.commands.registerCommand("pintia.checkIn", () => user.checkInPTA()),
		// vscode.commands.registerCommand("pintia.submitSolution", async () => { selectWorkspaceFolder(); }),
		vscode.commands.registerCommand("pintia.submitSolution", async (uri: vscode.Uri, testCode?: string) => { submit.submitSolution(uri, testCode); }),
// 		vscode.commands.registerCommand("pintia.submitSolution", () => ptaSubmissionProvider.showSubmission(JSON.parse(`
// {"queued": -1, "submission": { "id": "1516021537063739392", "user": { "studentUser": { "studentNumber": "", "name": "", "id": "0" } }, "problemType": "PROGRAMMING", "problemSetProblem": { "id": "709", "label": "7-1", "type": "PROGRAMMING", "problemPoolIndex": 1, "indexInProblemPool": 1 }, "submitAt": "2022-04-18T11:51:15Z", "status": "ACCEPTED", "score": 20, "compiler": "GXX", "time": 0.012, "memory": 1273856, "submissionDetails": [ { "problemSetProblemId": "709", "programmingSubmissionDetail": { "compiler": "GXX", "program": "program" }, "problemId": "0" } ], "judgeResponseContents": [ { "status": "ACCEPTED", "score": 20, "programmingJudgeResponseContent": { "compilationResult": { "log": "thisi is compilation result.", "success": true, "error": "" }, "checkerCompilationResult": { "log": "", "success": false, "error": "" }, "testcaseJudgeResults": { "0": { "result": "ACCEPTED", "exceed": "UNKNOWN_TESTCASE_EXCEED", "time": 0.004, "memory": 466944, "exitcode": 0, "termsig": 0, "error": "", "stdout": "", "stderr": "", "checkerOutput": "", "testcaseScore": 12, "stdoutTruncated": false, "stderrTruncated": false }, "1": { "result": "ACCEPTED", "exceed": "UNKNOWN_TESTCASE_EXCEED", "time": 0.003, "memory": 339968, "exitcode": 0, "termsig": 0, "error": "", "stdout": "", "stderr": "", "checkerOutput": "", "testcaseScore": 2, "stdoutTruncated": false, "stderrTruncated": false }, "2": { "result": "ACCEPTED", "exceed": "UNKNOWN_TESTCASE_EXCEED", "time": 0.004, "memory": 335872, "exitcode": 0, "termsig": 0, "error": "", "stdout": "", "stderr": "", "checkerOutput": "", "testcaseScore": 2, "stdoutTruncated": false, "stderrTruncated": false }, "3": { "result": "ACCEPTED", "exceed": "UNKNOWN_TESTCASE_EXCEED", "time": 0.006, "memory": 618496, "exitcode": 0, "termsig": 0, "error": "", "stdout": "", "stderr": "", "checkerOutput": "", "testcaseScore": 2, "stdoutTruncated": false, "stderrTruncated": false }, "4": { "result": "ACCEPTED", "exceed": "UNKNOWN_TESTCASE_EXCEED", "time": 0.012, "memory": 1273856, "exitcode": 0, "termsig": 0, "error": "", "stdout": "", "stderr": "", "checkerOutput": "", "testcaseScore": 2, "stdoutTruncated": false, "stderrTruncated": false } } }, "problemSetProblemId": "709" } ], "hints": { "0": "sample 有正负，负数开头结尾，最大和有更新", "1": "100个随机数", "2": "1000个随机数", "3": "10000个随机数", "4": "100000个随机数" }, "problemSetId": "15", "previewSubmission": false, "cause": ""}}`))),
		vscode.window.createTreeView("pintiaExplorer", { treeDataProvider: pintiaTreeDataProvider, showCollapseAll: false }),
	);

	await ptaManager.fetchLoginStatus();
}

export function deactivate() { }
