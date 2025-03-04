import * as vscode from "vscode";
import { OpenOptionEnum } from "./utils/workspaceUtils";

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

    public getProblemFileName(): string {
        return this.getConfiguration().get<string>("file.problemFileNameFormat", "{label} {title}");
    }

    public setProblemFileName(fileName: string) {
        this.update("file.problemFileNameFormat", fileName);
    }

    public getReplaceSpaceWithUnderscore(): boolean {
        return this.getConfiguration().get<boolean>("file.replaceSpaceWithUnderscore", false);
    }

    public setReplaceSpaceWithUnderscore(replace: boolean) {
        this.update("file.replaceSpaceWithUnderscore", replace);
    }
    
    public getConvertChineseCharacters(): boolean {
        return this.getConfiguration().get<boolean>("file.convertChineseCharacters", false);
    }
    
    public setConvertChineseCharacters(convert: boolean) {
        this.update("file.convertChineseCharacters", convert);
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

    public getSearchIndexIgnoreLockedProblemSets(): boolean {
        return this.getConfiguration().get<boolean>("searchIndex.ignoreLockedProblemSets", true);
    }

    public setSearchIndexIgnoreLockedProblemSets(ignoredLocked: boolean) {
        this.update("searchIndex.ignoreLockedProblemSets", ignoredLocked);
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

    public getCodeColorTheme(): string {
        return this.getConfiguration().get<string>("codeColorTheme", "atom-one");
    }

    public setCodeColorTheme(codeColorTheme: string) {
        this.update("codeColorTheme", codeColorTheme);
    }

    public getProblemHistoryListSize(): number {
        return this.getConfiguration().get<number>("problemHistoryListSize", 200);
    }

    public setProblemHistoryListSize(problemHistoryListSize: number) {
        this.update("problemHistoryListSize", problemHistoryListSize);
    }

    public getPreviewProblemAndCodeIt(): boolean {
        return this.getConfiguration().get<boolean>("previewProblem.openAndCodeIt", true);
    }

    public setPreviewProblemAndCodeIt(previewProblemAndCodeIt: boolean) {
        this.update("previewProblemAndCodeIt", previewProblemAndCodeIt);
    }

    public getPreviewProblemDefaultOpenedMethod(): string {
        return this.getConfiguration().get<string>("previewProblem.defaultOpenedMethod", OpenOptionEnum.alwaysAsk);
    }

    public setPreviewProblemDefaultOpenedMethod(previewProblemDefaultOpenedMethod: string) {
        this.update("previewProblem.defaultOpenedMethod", previewProblemDefaultOpenedMethod);
    }
}

export const ptaConfig: PtaConfig = new PtaConfig();
