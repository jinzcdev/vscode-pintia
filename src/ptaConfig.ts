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
        return this.getConfiguration().get<string>("workspaceFolder", "");
    }

    public setWorkspaceFolder(workspaceFolder: string) {
        this.update("workspaceFolder", workspaceFolder);
    }
    public getHideSolved(): boolean {
        return this.getConfiguration().get<boolean>("hideSolved", false);
    }

    public setHideSolved(hideSolved: boolean) {
        this.update("hideSolved", hideSolved);
    }

    public getShowLocked(): boolean {
        return this.getConfiguration().get<boolean>("showLocked", true);
    }

    public setShowLocked(showLocked: boolean) {
        this.update("showLocked", showLocked);
    }

    public getDefaultLanguage(): string {
        return this.getConfiguration().get<string>("defaultLanguage", "");
    }

    public setDefaultLanguage(defaultLanguage: string) {
        this.update("defaultLanguage", defaultLanguage);
    }

    public getEnableStatusBar(): boolean {
        return this.getConfiguration().get<boolean>("enableStatusBar", true);
    }

    public setEnableStatusBar(enableStatusBar: boolean) {
        this.update("enableStatusBar", enableStatusBar);
    }

    public getAutoCheckIn(): boolean {
        return this.getConfiguration().get<boolean>("autoCheckIn", false);
    }

    public setAutoCheckIn(autoCheckIn: boolean) {
        this.update("autoCheckIn", autoCheckIn);
    }

    public getFilePath(): string {
        return this.getConfiguration().get<string>("filePath", "");
    }

    public setFilePath(filePath: string) {
        this.update("filePath", filePath);
    }


    public getEditorShortcuts(): string[] {
        return this.getConfiguration().get<string[]>("editor.shortcuts", []);
    }

    public setEditorShortcuts(editorShortcuts: string[]) {
        this.update("editor.shortcuts", editorShortcuts);
    }

    public getPageSize(): number {
        return this.getConfiguration().get<number>("paging.pageSize", 100);
    }

    public setPageSize(pageSize: number) {
        this.update("page.pageSize", pageSize);
    }

    public getSearchIndexIgnoreZOJ(): boolean {
        return this.getConfiguration().get<boolean>("searchIndex.ignoreZOJ", true);
    }

    public setSearchIndexIgnoreZOJ(ignoredZOJ: boolean) {
        this.update("searchIndex.ignoreZOJ", ignoredZOJ);
    }

    public getSearchIndexAutoRefresh(): boolean {
        return this.getConfiguration().get<boolean>("searchIndex.autoRefresh", false);
    }

    public setSearchIndexAutoRefresh(autoRefresh: boolean) {
        this.update("searchIndex.autoRefresh", autoRefresh);
    }

    public getAutoCreateProblemSetFolder(): boolean {
        return this.getConfiguration().get<boolean>("autoCreateProblemSetFolder", true);
    }

    public setAutoCreateProblemSetFolder(autoCreatePbsFolder: boolean) {
        this.update("autoCreateProblemSetFolder", autoCreatePbsFolder);
    }
}

export const ptaConfig: PtaConfig = new PtaConfig();
