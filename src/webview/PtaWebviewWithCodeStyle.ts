import * as vscode from "vscode";
import { ptaConfig } from "../ptaConfig";
import { colorThemeMapping } from "../shared";
import { PtaWebview } from "./PtaWebview";

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


}