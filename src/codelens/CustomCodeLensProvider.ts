
import * as vscode from "vscode";
import { ptaConfig } from "../ptaConfig";
import { IPtaCode } from "../shared";

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
            return undefined;
        }

        const content: string = document.getText();
        const ptaCode: IPtaCode | null = this.parseCodeInfo(content);
        if (!ptaCode) {
            return undefined;
        }

        const code: ICodeBlock[] = this.parseCodeBlock(content, "@pintia code=start", "@pintia code=end");
        if (code.length !== 0) {
            ptaCode.code = code[0].code;
        }
        const customTestDatas: ICodeBlock[] = this.parseCodeBlock(content, "@pintia test=start", "@pintia test=end");
        ptaCode.customTests = customTestDatas.map((value, _) => value.code);

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
                arguments: [ptaCode],  // passed to the calling function
            }));
        }

        if (shortcuts.indexOf("test") >= 0) {
            codeLens.push(new vscode.CodeLens(range, {
                title: "Test",
                command: "pintia.testSolution",
                arguments: [ptaCode],
            }));
        }

        for (let i = 0; i < customTestDatas.length; i++) {
            const testCase = customTestDatas[i];
            codeLens.push(new vscode.CodeLens(
                new vscode.Range(testCase.lineNum, 0, testCase.lineNum, 0), {
                title: `Test custom sample ${i + 1}`,
                command: "pintia.testCustomSample",
                arguments: [ptaCode, i]
            }
            ));
        }
        return codeLens;
    }

    private parseCodeInfo(data: string): IPtaCode | null {
        const matchResult: RegExpMatchArray | null = data.match(/@pintia psid=(.*) pid=(.*) compiler=(.*)/);
        if (!matchResult) {
            return null;
        }
        return {
            psID: matchResult[1],
            pID: matchResult[2],
            compiler: matchResult[3]
        }
    }

    private parseCodeBlock(data: string, start: string, end: string): ICodeBlock[] {
        const codeblock: ICodeBlock[] = [], lines: string[] = data.split('\n');
        let startLine: number = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].indexOf(start) != -1) {
                startLine = i + 1;
            } else if (lines[i].indexOf(end) != -1 && startLine != -1 && startLine < i) {
                const code: string = lines.slice(startLine, i).join("\n");
                if (!code.trim().length) continue;
                codeblock.push({
                    lineNum: startLine,
                    code: lines.slice(startLine, i).join("\n")
                });
                startLine = -1;
            }
        }
        return codeblock;
    }

}

interface ICodeBlock {
    lineNum: number;
    code: string
}

export const customCodeLensProvider: CustomCodeLensProvider = new CustomCodeLensProvider();
