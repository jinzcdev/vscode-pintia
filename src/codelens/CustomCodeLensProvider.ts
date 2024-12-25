import * as vscode from "vscode";
import { ptaConfig } from "../ptaConfig";
import { IPtaCode } from "../shared";
import { l10n } from "vscode";

export class CustomCodeLensProvider implements vscode.CodeLensProvider<PtaCodeLens> {

    private onDidChangeCodeLensesEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    get onDidChangeCodeLenses(): vscode.Event<void> {
        return this.onDidChangeCodeLensesEmitter.event;
    }

    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<PtaCodeLens[]> {
        const shortcuts: string[] = ptaConfig.getEditorShortcuts();
        if (!shortcuts || shortcuts.length === 0) {
            return undefined;
        }

        const content: string = document.getText();
        const ptaCode: IPtaCode | null = this.parseCodeInfo(content);
        if (!ptaCode) {
            return undefined;
        }

        const range: vscode.Range = this.getCodeLensRange(document, /@pintia\s+code=end/g)[0];
        const codeLens: PtaCodeLens[] = shortcuts.map(shortcut => new PtaCodeLens(range, document.uri.fsPath, content, shortcut));

        const customTestRanges: vscode.Range[] = this.getCodeLensRange(document, /@pintia\s+test=start/g);
        for (let i = 0; i < customTestRanges.length; i++) {
            codeLens.push(new PtaCodeLens(customTestRanges[i], document.uri.fsPath, content, "customTest", i));
        }
        return codeLens;
    }

    public resolveCodeLens(codeLens: PtaCodeLens, token: vscode.CancellationToken): vscode.ProviderResult<PtaCodeLens> {
        if (codeLens instanceof PtaCodeLens) {
            const command = codeLens.commandTitle;
            const ptaCode: IPtaCode | null = this.parseCodeInfo(codeLens.codeContent);
            if (!ptaCode) {
                return codeLens;
            }
            const code: ICodeBlock[] = this.parseCodeBlock(codeLens.codeContent, "@pintia\\s+code=start\\s*?\\n", "\\n[^\\n]*?@pintia\\s+code=end");
            if (code.length !== 0) {
                ptaCode.code = code[0].code;
            }
            const customTests: ICodeBlock[] = this.parseCodeBlock(codeLens.codeContent, "@pintia\\s+test=start\\s*?\\n", "\\n[^\\n]*?@pintia\\s+test=end");
            ptaCode.customTests = customTests.map((value, _) => value.code);

            if (command === "Submit") {
                codeLens.command = {
                    title: vscode.l10n.t("Submit"),
                    command: "pintia.submitSolution",
                    arguments: [ptaCode],
                };
            } else if (command === "Test") {
                codeLens.command = {
                    title: l10n.t("Test"),
                    command: "pintia.testSolution",
                    arguments: [ptaCode],
                };
            } else if (command === "customTest") {
                codeLens.command = {
                    title: l10n.t("Test custom sample {0}", codeLens.customTestIndex! + 1),
                    command: "pintia.testCustomSample",
                    arguments: [ptaCode, codeLens.customTestIndex],
                };
            } else if (command === "Preview") {
                codeLens.command = {
                    title: l10n.t("Preview"),
                    command: "pintia.previewProblem",
                    arguments: [ptaCode.psID, ptaCode.pID, false],
                };
            }
        }
        return codeLens;
    }

    private parseCodeInfo(data: string): IPtaCode | null {
        const matchResult: RegExpMatchArray | null = data.match(/@pintia\s+psid=(\S+)\s+pid=(\S+)\s+compiler=(\S+)/);
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
        const codeblock: ICodeBlock[] = [];
        const regex = new RegExp(`${start}([\\s\\S]*?)${end}`, 'g');
        let match;
        while ((match = regex.exec(data)) !== null) {
            const code = match[1].trim();
            if (code.length > 0) {
                const startLine = data.substring(0, match.index).split('\n').length;
                codeblock.push({
                    lineNum: startLine,
                    code: code
                });
            }
        }
        return codeblock;
    }

    private getCodeLensRange(document: vscode.TextDocument, regex: RegExp): vscode.Range[] {
        const text = document.getText();
        const ranges = [];
        let matches, textLine = document.lineAt(document.lineCount - 1);
        while ((matches = regex.exec(text)) !== null) {
            textLine = document.lineAt(document.positionAt(matches.index).line);
            textLine?.range && ranges.push(textLine.range);
        }
        return ranges;
    }
}

class PtaCodeLens extends vscode.CodeLens {
    constructor(
        range: vscode.Range,
        public filePath: string,
        public codeContent: string,
        public commandTitle: string,
        public customTestIndex?: number
    ) {
        super(range);
    }
}

interface ICodeBlock {
    lineNum: number;
    code: string
}

export const customCodeLensProvider: CustomCodeLensProvider = new CustomCodeLensProvider();