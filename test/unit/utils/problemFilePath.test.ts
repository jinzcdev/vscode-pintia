import * as assert from "assert";
import * as path from "path";
import { IProblemFilePathOptions, resolveProblemFilePath } from "../../../src/utils/problemFilePath";

const WORKSPACE = path.join(path.sep, "ws", "pintia");

/** 构造默认选项，用例只覆盖自己关心的字段 */
function createOptions(overrides: Partial<IProblemFilePathOptions> = {}): IProblemFilePathOptions {
    return {
        workspaceFolder: WORKSPACE,
        problemFileNameFormat: "{label} {title}",
        label: "A1001",
        title: "Hello World",
        pID: "12345",
        psID: "ps1",
        ext: "cpp",
        psName: undefined,
        autoCreateProblemSetFolder: false,
        customProblemSetName: {},
        replaceSpaceWithUnderscore: false,
        convertChineseCharacters: false,
        invalidCharReplacement: "_",
        ...overrides,
    };
}

describe("problemFilePath - resolveProblemFilePath", () => {
    describe("文件名", () => {
        it("默认格式应拼出「标签 标题.扩展名」", () => {
            const { filePath } = resolveProblemFilePath(createOptions());

            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 Hello World.cpp"));
        });

        it("应支持全部占位符", () => {
            const { filePath } = resolveProblemFilePath(
                createOptions({ problemFileNameFormat: "{psid}-{pid}-{label}" })
            );

            assert.strictEqual(filePath, path.join(WORKSPACE, "ps1-12345-A1001.cpp"));
        });

        it("标题中的非法字符应被净化，不得多出目录层级", () => {
            const { filePath } = resolveProblemFilePath(createOptions({ title: "Hello/World" }));

            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 Hello_World.cpp"));
        });

        it("开启中文转写后，转写出的非法字符仍应被净化——顺序回归", () => {
            const { filePath } = resolveProblemFilePath(
                createOptions({ title: "A／B", convertChineseCharacters: true })
            );

            // 修复前：净化先于转写执行，得到 "A/B" 从而多出一层目录
            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 A_B.cpp"));
            assert.strictEqual(filePath.includes(`${path.sep}B.cpp`), false, "不得产生嵌套路径");
        });

        it("关闭中文转写时全角标点保留原样（不参与净化）", () => {
            const { filePath } = resolveProblemFilePath(createOptions({ title: "A／B" }));

            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 A／B.cpp"));
        });

        it("替换符可配置，且空格替换先于净化执行", () => {
            const dashed = resolveProblemFilePath(createOptions({ title: "A/B", invalidCharReplacement: "-" }));
            const underscored = resolveProblemFilePath(
                createOptions({ title: "A B/C", replaceSpaceWithUnderscore: true })
            );

            assert.strictEqual(dashed.filePath, path.join(WORKSPACE, "A1001 A-B.cpp"));
            assert.strictEqual(underscored.filePath, path.join(WORKSPACE, "A1001_A_B_C.cpp"));
        });

        it("替换符为空串时应删除非法字符", () => {
            const { filePath } = resolveProblemFilePath(createOptions({ title: "A/B", invalidCharReplacement: "" }));

            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 AB.cpp"));
        });

        it("替换符本身非法时应回退为下划线，而不是重现嵌套目录", () => {
            const { filePath } = resolveProblemFilePath(createOptions({ title: "A/B", invalidCharReplacement: "/" }));

            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 A_B.cpp"));
        });

        it("净化后为空时应回退到 pID，不得生成隐藏的 .cpp", () => {
            const empty = resolveProblemFilePath(createOptions({ problemFileNameFormat: "{title}", title: "" }));
            const onlyInvalid = resolveProblemFilePath(
                createOptions({ problemFileNameFormat: "{title}", title: "/", invalidCharReplacement: "" })
            );

            assert.strictEqual(empty.filePath, path.join(WORKSPACE, "12345.cpp"));
            assert.strictEqual(onlyInvalid.filePath, path.join(WORKSPACE, "12345.cpp"));
        });

        it("结果为 . 或 .. 时应回退到 pID，避免越出工作区", () => {
            const dot = resolveProblemFilePath(createOptions({ problemFileNameFormat: "{title}", title: "." }));
            const dotdot = resolveProblemFilePath(createOptions({ problemFileNameFormat: "{title}", title: ".." }));

            assert.strictEqual(dot.filePath, path.join(WORKSPACE, "12345.cpp"));
            assert.strictEqual(dotdot.filePath, path.join(WORKSPACE, "12345.cpp"));
        });
    });

    describe("题集文件夹名", () => {
        it("未开启自动建目录时不应产生子目录", () => {
            const { filePath } = resolveProblemFilePath(createOptions({ psName: "算法练习" }));

            assert.strictEqual(filePath, path.join(WORKSPACE, "A1001 Hello World.cpp"));
        });

        it("题集名含 `/` 时应被净化——issue #25 的主现象", () => {
            const { filePath } = resolveProblemFilePath(
                createOptions({ autoCreateProblemSetFolder: true, psName: "1.分支结构(if /" })
            );

            assert.strictEqual(filePath, path.join(WORKSPACE, "1.分支结构(if _", "A1001 Hello World.cpp"));
        });

        it("题集名经中文转写后产生的非法字符也应被净化", () => {
            const { filePath } = resolveProblemFilePath(
                createOptions({
                    autoCreateProblemSetFolder: true,
                    psName: "第七章／数组",
                    convertChineseCharacters: true,
                })
            );

            assert.strictEqual(filePath, path.join(WORKSPACE, "di-qi-zhang_shu-zu", "A1001 Hello World.cpp"));
        });

        it("净化后为空时应回退到 psID", () => {
            const { filePath } = resolveProblemFilePath(
                createOptions({
                    autoCreateProblemSetFolder: true,
                    psName: "/",
                    invalidCharReplacement: "",
                })
            );

            assert.strictEqual(filePath, path.join(WORKSPACE, "ps1", "A1001 Hello World.cpp"));
        });

        it("合法自定义题集名应生效，且不参与中文转写", () => {
            const result = resolveProblemFilePath(
                createOptions({
                    autoCreateProblemSetFolder: true,
                    psName: "算法练习",
                    convertChineseCharacters: true,
                    customProblemSetName: { ps1: "Algo_Set" },
                })
            );

            assert.strictEqual(result.filePath, path.join(WORKSPACE, "Algo_Set", "A1001 Hello World.cpp"));
            assert.strictEqual(result.customProblemSetNameInvalid, false);
        });

        it("非法自定义题集名应回退到默认名并回报调用方——回归", () => {
            const result = resolveProblemFilePath(
                createOptions({
                    autoCreateProblemSetFolder: true,
                    psName: "算法练习",
                    customProblemSetName: { ps1: "Algo/Set" },
                })
            );

            assert.strictEqual(result.customProblemSetNameInvalid, true);
            assert.strictEqual(result.filePath, path.join(WORKSPACE, "算法练习", "A1001 Hello World.cpp"));
        });

        it("自定义名为空串时不应视为非法", () => {
            const result = resolveProblemFilePath(
                createOptions({
                    autoCreateProblemSetFolder: true,
                    psName: "算法练习",
                    customProblemSetName: { ps1: "" },
                })
            );

            assert.strictEqual(result.customProblemSetNameInvalid, false);
            assert.strictEqual(result.filePath, path.join(WORKSPACE, "算法练习", "A1001 Hello World.cpp"));
        });

        it("其它题集的自定义名不应影响当前题集", () => {
            const result = resolveProblemFilePath(
                createOptions({
                    autoCreateProblemSetFolder: true,
                    psName: "算法练习",
                    customProblemSetName: { "ps-other": "Algo_Set" },
                })
            );

            assert.strictEqual(result.filePath, path.join(WORKSPACE, "算法练习", "A1001 Hello World.cpp"));
        });
    });
});
