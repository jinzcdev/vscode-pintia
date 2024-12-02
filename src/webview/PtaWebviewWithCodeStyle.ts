import * as vscode from "vscode";
import { ptaConfig } from "../ptaConfig";
import { colorThemeMapping } from "../shared";
import { PtaWebview } from "./PtaWebview";
import { getGlobalContext } from "../extension";
import * as path from 'path';

export abstract class PtaWebviewWithCodeStyle<T> extends PtaWebview<T> {

    protected activeColorTheme: string = "atom-one-dark.css";

    constructor(view: T) {
        super(view);
        vscode.window.onDidChangeActiveColorTheme((e) => {
            const mapping = colorThemeMapping.get(ptaConfig.getCodeColorTheme());
            if (!mapping) {
                return;
            }
            this.activeColorTheme = mapping[e.kind === vscode.ColorThemeKind.Light ? 0 : 1];
            this.show(false);
        });
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("pintia.codeColorTheme")) {
                const colorThemeKind: vscode.ColorThemeKind = vscode.window.activeColorTheme.kind;
                const mapping = colorThemeMapping.get(ptaConfig.getCodeColorTheme());
                if (!mapping) {
                    return;
                }
                this.activeColorTheme = mapping[colorThemeKind === vscode.ColorThemeKind.Light ? 0 : 1];
                this.show(false);
            }
        });
    }

    protected getStyle(): string {

        const katexCssPath = this.getWebview()?.asWebviewUri(vscode.Uri.file(path.resolve(require.resolve("katex/dist/katex.min.css"))));
        const highlightCssPath = this.getWebview()?.asWebviewUri(vscode.Uri.file(path.resolve(require.resolve(`highlight.js/styles/${this.activeColorTheme}`))));
        const previewCssPath = this.getWebview()?.asWebviewUri(vscode.Uri.joinPath(getGlobalContext().extensionUri, "media", "preview_submission.css"));

        return `
            <link rel="stylesheet" href="${katexCssPath}">
            <link rel="stylesheet" href="${highlightCssPath}">
            <link rel="stylesheet" href="${previewCssPath}">`
    }

}