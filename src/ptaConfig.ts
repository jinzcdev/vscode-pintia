import * as vscode from "vscode";

class PtaConfig {

    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration("pintia");
    }

    private get<T>(section: string, defaultValue: T): T {
        return this.getConfiguration().get<T>(section, defaultValue);
    }

    public async update(section: string, value: any): Promise<void> {
        await this.getConfiguration().update(section, value, true);
    }

    public getWorkspaceFolder(): string {
        return this.get<string>("workspaceFolder", "");
    }

    public setWorkspaceFolder(workspaceFolder: string) {
        this.update("workspaceFolder", workspaceFolder);
    }
    public getHideSolved(): boolean {
        return this.get<boolean>("hideSolved", false);
    }

    public setHideSolved(hideSolved: boolean) {
        this.update("hideSolved", hideSolved);
    }

    public getShowLocked(): boolean {
        return this.get<boolean>("showLocked", true);
    }

    public setShowLocked(showLocked: boolean) {
        this.update("showLocked", showLocked);
    }

    public getDefaultLanguage(): string {
        return this.get<string>("defaultLanguage", "");
    }

    public setDefaultLanguage(defaultLanguage: string) {
        this.update("defaultLanguage", defaultLanguage);
    }

    public getEnableStatusBar(): boolean {
        return this.get<boolean>("enableStatusBar", true);
    }

    public setEnableStatusBar(enableStatusBar: boolean) {
        this.update("enableStatusBar", enableStatusBar);
    }

    public getFilePath(): string {
        return this.get<string>("filePath", "");
    }

    public setFilePath(filePath: string) {
        this.update("filePath", filePath);
    }


    public getEditorShortcuts(): string[] {
        return this.get<string[]>("editor.shortcuts", []);
    }

    public setEditorShortcuts(editorShortcuts: string[]) {
        this.update("editor.shortcuts", editorShortcuts);
    }
}

export const ptaConfig: PtaConfig = new PtaConfig();
