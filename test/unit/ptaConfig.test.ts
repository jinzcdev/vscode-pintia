import * as assert from "assert";
import { ptaConfig } from "../../src/ptaConfig";
import { OpenOptionEnum } from "../../src/utils/workspaceUtils";
import { resetConfigValues, setConfigValue } from "../setup";

describe("ptaConfig", () => {
    beforeEach(() => {
        resetConfigValues();
    });

    afterEach(() => {
        resetConfigValues();
    });

    describe("默认值", () => {
        it("工作区与文件相关配置应有预期默认值", () => {
            assert.strictEqual(ptaConfig.getWorkspaceFolder(), "");
            assert.strictEqual(ptaConfig.getAutoCreateProblemSetFolder(), true);
            assert.strictEqual(ptaConfig.getProblemFileName(), "{label} {title}");
            assert.strictEqual(ptaConfig.getReplaceSpaceWithUnderscore(), false);
            assert.strictEqual(ptaConfig.getConvertChineseCharacters(), false);
            assert.strictEqual(ptaConfig.getInvalidCharReplacement(), "_");
            assert.strictEqual(ptaConfig.getFilePath(), "");
        });

        it("界面与编辑器相关配置应有预期默认值", () => {
            assert.strictEqual(ptaConfig.getHideSolved(), false);
            assert.strictEqual(ptaConfig.getShowLocked(), true);
            assert.strictEqual(ptaConfig.getEnableStatusBar(), true);
            assert.strictEqual(ptaConfig.getDefaultLanguage(), "");
            assert.deepStrictEqual(ptaConfig.getEditorShortcuts(), []);
            assert.strictEqual(ptaConfig.getCodeColorTheme(), "atom-one");
            assert.strictEqual(ptaConfig.getPageSize(), 100);
            assert.strictEqual(ptaConfig.getProblemHistoryListSize(), 200);
        });

        it("搜索索引与预览相关配置应有预期默认值", () => {
            assert.strictEqual(ptaConfig.getSearchIndexIgnoreZOJ(), true);
            assert.strictEqual(ptaConfig.getSearchIndexIgnoreLockedProblemSets(), true);
            assert.strictEqual(ptaConfig.getSearchIndexAutoRefresh(), false);
            assert.strictEqual(ptaConfig.getAutoCheckIn(), false);
            assert.strictEqual(ptaConfig.getPreviewProblemAndCodeIt(), true);
            assert.strictEqual(ptaConfig.getPreviewProblemDefaultOpenedMethod(), OpenOptionEnum.alwaysAsk);
        });
    });

    describe("读取覆盖后的配置", () => {
        it("应按 section 读取用户设置", () => {
            setConfigValue("workspaceFolder", "/tmp/codes");
            setConfigValue("paging.pageSize", 50);
            setConfigValue("editor.shortcuts", ["Submit", "Test"]);

            assert.strictEqual(ptaConfig.getWorkspaceFolder(), "/tmp/codes");
            assert.strictEqual(ptaConfig.getPageSize(), 50);
            assert.deepStrictEqual(ptaConfig.getEditorShortcuts(), ["Submit", "Test"]);
        });
    });

    describe("update", () => {
        it("写入的值应能被对应的 getter 读回", async () => {
            await ptaConfig.setWorkspaceFolder("/tmp/written");

            assert.strictEqual(ptaConfig.getWorkspaceFolder(), "/tmp/written");
        });
    });

    describe("getCustomProblemSetName", () => {
        it("未配置时应返回空对象", () => {
            assert.deepStrictEqual(ptaConfig.getCustomProblemSetName(), {});
        });

        it("空串或纯空白应返回空对象", () => {
            setConfigValue("file.customProblemSetName", "");
            assert.deepStrictEqual(ptaConfig.getCustomProblemSetName(), {});

            setConfigValue("file.customProblemSetName", "   ");
            assert.deepStrictEqual(ptaConfig.getCustomProblemSetName(), {});
        });

        it("合法 JSON 应解析为题集名映射", () => {
            setConfigValue("file.customProblemSetName", '{"ps1": "数组练习", "ps2": "Array"}');

            assert.deepStrictEqual(ptaConfig.getCustomProblemSetName(), { ps1: "数组练习", ps2: "Array" });
        });

        it("非法 JSON 应返回空对象且不抛错", () => {
            setConfigValue("file.customProblemSetName", "{not-json");

            assert.deepStrictEqual(ptaConfig.getCustomProblemSetName(), {});
        });
    });
});
