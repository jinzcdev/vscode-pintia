import * as assert from "assert";
import * as path from "path";
import * as fs from "fs-extra";
import { ptaConfig } from "../../src/ptaConfig";
import { OpenOptionEnum } from "../../src/utils/workspaceUtils";
import { resetConfigValues, setConfigValue } from "../setup";

/**
 * 与 package.json 声明的一致性。
 *
 * VS Code 的实际取值顺序是「用户设置 → package.json 声明的 default → get() 的第二参数」，
 * 因此第二参数只在设置未声明时才生效。两处默认值若不一致，就会让「设置界面显示的默认值」
 * 与「代码实际使用的默认值」不同，且只会在用户从未改过该项时暴露出来——
 * 本用例把这类漂移挡在提交前。
 */
describe("ptaConfig - 与 package.json 声明的一致性", () => {
    const packageJson = fs.readJSONSync(path.resolve(__dirname, "../../../package.json"));
    const declaredDefaults: Record<string, unknown> = {};
    for (const group of packageJson.contributes.configuration) {
        for (const [key, schema] of Object.entries<{ default: unknown }>(group.properties)) {
            declaredDefaults[key] = schema.default;
        }
    }

    /** 设置项 → 读取其当前生效值的 getter（读取时需变换的在这里还原，如 JSON 字符串） */
    const readers: Record<string, () => unknown> = {
        "pintia.workspaceFolder": () => ptaConfig.getWorkspaceFolder(),
        "pintia.autoCreateProblemSetFolder": () => ptaConfig.getAutoCreateProblemSetFolder(),
        "pintia.defaultLanguage": () => ptaConfig.getDefaultLanguage(),
        "pintia.editor.shortcuts": () => ptaConfig.getEditorShortcuts(),
        "pintia.file.problemFileNameFormat": () => ptaConfig.getProblemFileName(),
        "pintia.file.replaceSpaceWithUnderscore": () => ptaConfig.getReplaceSpaceWithUnderscore(),
        "pintia.file.convertChineseCharacters": () => ptaConfig.getConvertChineseCharacters(),
        "pintia.file.customProblemSetName": () => JSON.stringify(ptaConfig.getCustomProblemSetName()),
        "pintia.file.invalidCharReplacement": () => ptaConfig.getInvalidCharReplacement(),
        "pintia.codeColorTheme": () => ptaConfig.getCodeColorTheme(),
        "pintia.enableStatusBar": () => ptaConfig.getEnableStatusBar(),
        "pintia.previewProblem.openAndCodeIt": () => ptaConfig.getPreviewProblemAndCodeIt(),
        "pintia.previewProblem.defaultOpenedMethod": () => ptaConfig.getPreviewProblemDefaultOpenedMethod(),
        "pintia.showLocked": () => ptaConfig.getShowLocked(),
        "pintia.paging.pageSize": () => ptaConfig.getPageSize(),
        "pintia.problemHistoryListSize": () => ptaConfig.getProblemHistoryListSize(),
        "pintia.searchIndex.ignoreZOJ": () => ptaConfig.getSearchIndexIgnoreZOJ(),
        "pintia.searchIndex.ignoreLockedProblemSets": () => ptaConfig.getSearchIndexIgnoreLockedProblemSets(),
        "pintia.searchIndex.autoRefresh": () => ptaConfig.getSearchIndexAutoRefresh(),
        "pintia.autoCheckIn": () => ptaConfig.getAutoCheckIn(),
    };

    it("每个声明的设置项都应有对应的读取方法（新增设置时需同步本表）", () => {
        const uncovered = Object.keys(declaredDefaults).filter((key) => !(key in readers));

        assert.deepStrictEqual(uncovered, [], `以下设置项未纳入本用例: ${uncovered.join(", ")}`);
    });

    it("getter 的兜底值应与 package.json 声明的默认值完全一致", () => {
        const mismatched = Object.entries(readers)
            .filter(([key]) => key in declaredDefaults)
            .filter(([key, read]) => !isDeepStrictEqual(read(), declaredDefaults[key]))
            .map(
                ([key, read]) =>
                    `${key}: 代码为 ${JSON.stringify(read())}，声明为 ${JSON.stringify(declaredDefaults[key])}`
            );

        assert.deepStrictEqual(mismatched, [], `默认值不一致:\n  ${mismatched.join("\n  ")}`);
    });

    /** 逐项比较，避免 assert 在第一个不一致处就中断，从而能一次报出全部漂移 */
    function isDeepStrictEqual(actual: unknown, expected: unknown): boolean {
        try {
            assert.deepStrictEqual(actual, expected);
            return true;
        } catch {
            return false;
        }
    }
});

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
        });

        it("界面与编辑器相关配置应有预期默认值", () => {
            assert.strictEqual(ptaConfig.getShowLocked(), true);
            assert.strictEqual(ptaConfig.getEnableStatusBar(), true);
            assert.strictEqual(ptaConfig.getDefaultLanguage(), "C++ (g++)");
            assert.deepStrictEqual(ptaConfig.getEditorShortcuts(), ["Submit", "Test", "Preview"]);
            assert.strictEqual(ptaConfig.getCodeColorTheme(), "atom-one");
            assert.strictEqual(ptaConfig.getPageSize(), 100);
            assert.strictEqual(ptaConfig.getProblemHistoryListSize(), 200);
        });

        it("搜索索引与预览相关配置应有预期默认值", () => {
            assert.strictEqual(ptaConfig.getSearchIndexIgnoreZOJ(), true);
            assert.strictEqual(ptaConfig.getSearchIndexIgnoreLockedProblemSets(), true);
            assert.strictEqual(ptaConfig.getSearchIndexAutoRefresh(), false);
            assert.strictEqual(ptaConfig.getAutoCheckIn(), true);
            assert.strictEqual(ptaConfig.getPreviewProblemAndCodeIt(), false);
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
