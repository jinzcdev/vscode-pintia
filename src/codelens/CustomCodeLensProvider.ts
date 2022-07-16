
import * as vscode from "vscode";
import { explorerNodeManager } from "../explorer/explorerNodeManager";
import { PtaNode } from "../explorer/PtaNode";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";

export class CustomCodeLensProvider implements vscode.CodeLensProvider {

    private onDidChangeCodeLensesEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    get onDidChangeCodeLenses(): vscode.Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
        const shortcuts: string[] = ptaConfig.getEditorShortcuts();
        if (!shortcuts || shortcuts.length === 0) {
            return;
        }

        const content: string = document.getText();
        const matchResult: RegExpMatchArray | null = content.match(/@pintia psid=(.*) pid=(.*) type=(.*) compiler=(.*)/);

        if (!matchResult) {
            return undefined;
        }
        const nodeId: string | undefined = matchResult[1];
        // let node: PtaNode | undefined;
        // if (nodeId) {
        //     node = explorerNodeManager.getNodeById(nodeId);
        // }

        let codeLensLine: number = document.lineCount - 1;
        for (let i: number = document.lineCount - 1; i >= 0; i--) {
            const lineContent: string = document.lineAt(i).text;
            if (lineContent.indexOf("@pintia code=end") >= 0) {
                codeLensLine = i;
                break;
            }
        }

        // default: add codelens in the end of the file
        // if "@pintia code=end" is not in the end, codelens will be put in the next line of it.
        const range: vscode.Range = new vscode.Range(codeLensLine, 0, codeLensLine, 0);
        const codeLens: vscode.CodeLens[] = [];

        if (shortcuts.indexOf("submit") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "Submit",
                command: "pintia.submitSolution",
                arguments: [document.uri],  // passed to the calling function
            }));
        }

        if (shortcuts.indexOf("test") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "Test",
                command: "pintia.submitSolution",
                arguments: [document.uri, "100311"],
            }));
        }

        /*
        if (shortcuts.indexOf("star") >= 0 && node) {
            codeLens.push(new vscode.CodeLens(range, {
                title: node.isFavorite ? "Unstar" : "Star",
                command: node.isFavorite ? "pintia.removeFavorite" : "pintia.addFavorite",
                arguments: [node],
            }));
        }

        if (shortcuts.indexOf("solution") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "Solution",
                command: "pintia.showSolution",
                arguments: [document.uri],
            }));
        }

        if (shortcuts.indexOf("description") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "Description",
                command: "pintia.previewProblem",
                arguments: [document.uri],
            }));
        }
        */

        return codeLens;
    }
}

export const customCodeLensProvider: CustomCodeLensProvider = new CustomCodeLensProvider();
