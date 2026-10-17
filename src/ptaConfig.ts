import * as vscode from "vscode";
import { DEFAULT_INVALID_CHAR_REPLACEMENT } from "./utils/stringUtils";
import { ptaChannel } from "./ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "./utils/uiUtils";
import { OpenOptionEnum } from "./shared";

/**
 * 配置读写。
 *
 * 刻意只提供 getter 与 `update(key, value)`：此前每个设置项都配了一个 setter，
 * 但没有任何调用点，于是 `setPageSize`（写成了 `page.pageSize`）与
 * `setPreviewProblemAndCodeIt`（写成了 `previewProblemAndCodeIt`）的 key 一直是错的
 * 却无人发现。写入口收敛到 `update` 后，key 与 getter 是否一致由调用点直接可见。
 *
 * 注意 `package.json` 中这些设置声明为 `scope: "window"`，与本类「读写都不带
 * 资源 URI」的实现一致——若将来改成按文件夹生效，两边必须同时改。
 */
class PtaConfig {
    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration("pintia");
    }

    public async update(section: string, value: any): Promise<void> {
        await this.getConfiguration().update(section, value, true);
    }

    public getWorkspaceFolder(): string {
        return this.getConfiguration().get<string>("workspaceFolder", "");
    }

    public getShowLocked(): boolean {
        return this.getConfiguration().get<boolean>("showLocked", true);
    }

    public getDefaultLanguage(): string {
        return this.getConfiguration().get<string>("defaultLanguage", "C++ (g++)");
    }

    public getEnableStatusBar(): boolean {
        return this.getConfiguration().get<boolean>("enableStatusBar", true);
    }

    public getAutoCheckIn(): boolean {
        return this.getConfiguration().get<boolean>("autoCheckIn", true);
    }

    public getProblemFileName(): string {
        return this.getConfiguration().get<string>("file.problemFileNameFormat", "{label} {title}");
    }

    public getReplaceSpaceWithUnderscore(): boolean {
        return this.getConfiguration().get<boolean>("file.replaceSpaceWithUnderscore", false);
    }

    public getConvertChineseCharacters(): boolean {
        return this.getConfiguration().get<boolean>("file.convertChineseCharacters", false);
    }

    public getInvalidCharReplacement(): string {
        return this.getConfiguration().get<string>("file.invalidCharReplacement", DEFAULT_INVALID_CHAR_REPLACEMENT);
    }

    public getCustomProblemSetName(): Record<string, string> {
        try {
            const customNameJson = this.getConfiguration().get<string>("file.customProblemSetName", "{}");
            if (!customNameJson.trim()) {
                return {};
            }
            return JSON.parse(customNameJson);
        } catch (error: any) {
            ptaChannel.error(error.toString());
            promptForOpenOutputChannel(
                vscode.l10n.t(
                    "Failed to parse custom problem set name JSON. Please check the output channel for details."
                ),
                DialogType.error
            );
            return {};
        }
    }

    public getEditorShortcuts(): string[] {
        return this.getConfiguration().get<string[]>("editor.shortcuts", ["Submit", "Test", "Preview"]);
    }

    public getPageSize(): number {
        return this.getConfiguration().get<number>("paging.pageSize", 100);
    }

    public getSearchIndexIgnoreZOJ(): boolean {
        return this.getConfiguration().get<boolean>("searchIndex.ignoreZOJ", true);
    }

    public getSearchIndexIgnoreLockedProblemSets(): boolean {
        return this.getConfiguration().get<boolean>("searchIndex.ignoreLockedProblemSets", true);
    }

    public getSearchIndexAutoRefresh(): boolean {
        return this.getConfiguration().get<boolean>("searchIndex.autoRefresh", false);
    }

    public getAutoCreateProblemSetFolder(): boolean {
        return this.getConfiguration().get<boolean>("autoCreateProblemSetFolder", true);
    }

    public getCodeColorTheme(): string {
        return this.getConfiguration().get<string>("codeColorTheme", "atom-one");
    }

    public getProblemHistoryListSize(): number {
        return this.getConfiguration().get<number>("problemHistoryListSize", 200);
    }

    public getPreviewProblemAndCodeIt(): boolean {
        return this.getConfiguration().get<boolean>("previewProblem.openAndCodeIt", false);
    }

    public getPreviewProblemDefaultOpenedMethod(): string {
        return this.getConfiguration().get<string>("previewProblem.defaultOpenedMethod", OpenOptionEnum.alwaysAsk);
    }
}

export const ptaConfig: PtaConfig = new PtaConfig();
