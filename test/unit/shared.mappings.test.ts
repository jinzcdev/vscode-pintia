import * as assert from "assert";
import {
    colorThemeMapping,
    commentFormatMapping,
    compilerLangMapping,
    defaultPtaNode,
    langCompilerMapping,
    ProblemType,
    problemTypeInfoMapping,
    ptaCompiler,
    supportedProblemTypes,
    ZOJ_PROBLEM_SET_ID,
} from "../../src/shared";
import { ZOJ_PROBLEM_SET_ID as ZOJ_PROBLEM_SET_ID_FROM_CONSTANTS } from "../../src/searchIndex/constants";

/**
 * 这些表镜像自拼题A 网页端常量，属于「数据」而非逻辑。
 * 单个条目的增删不应让测试失败，但两表之间的结构性不变量必须成立。
 */
describe("shared - 常量表不变量", () => {
    describe("语言与编译器映射", () => {
        it("langCompilerMapping 与 compilerLangMapping 应互为逆映射", () => {
            for (const [language, compiler] of langCompilerMapping) {
                assert.strictEqual(
                    compilerLangMapping.get(compiler),
                    language,
                    `${language} → ${compiler} 在反向表中应为 ${language}`
                );
            }
            for (const [compiler, language] of compilerLangMapping) {
                assert.strictEqual(
                    langCompilerMapping.get(language),
                    compiler,
                    `${compiler} → ${language} 在正向表中应为 ${compiler}`
                );
            }
        });

        it("两表条目数应一致且编译器名不重复", () => {
            assert.strictEqual(langCompilerMapping.size, compilerLangMapping.size);
            const compilers = [...langCompilerMapping.values()];
            assert.strictEqual(new Set(compilers).size, compilers.length, "存在重复的编译器名");
        });

        it("除 NO_COMPILER 外，每个编译器都应存在于 ptaCompiler 表中", () => {
            const missing = [...compilerLangMapping.keys()].filter(
                (compiler) => !Object.prototype.hasOwnProperty.call(ptaCompiler, compiler)
            );
            assert.deepStrictEqual(missing, [], `编译器表缺少: ${missing.join(", ")}`);
        });

        it("ptaCompiler 每项的 name 应与键一致，ordinal 唯一", () => {
            const ordinals: number[] = [];
            for (const [key, compiler] of Object.entries(ptaCompiler)) {
                assert.strictEqual(compiler.name, key, `${key} 的 name 字段与键不一致`);
                ordinals.push(compiler.ordinal);
            }
            assert.strictEqual(new Set(ordinals).size, ordinals.length, "存在重复的 ordinal");
        });

        it("除 NO_COMPILER 外，每个编译器都应配置文件扩展名", () => {
            for (const [key, compiler] of Object.entries(ptaCompiler)) {
                if (key === "NO_COMPILER") {
                    assert.strictEqual(compiler.ext, "");
                    continue;
                }
                assert.notStrictEqual(compiler.ext, "", `${key} 缺少文件扩展名`);
            }
        });

        it("注释格式表的键应为合法语言名", () => {
            for (const language of commentFormatMapping.keys()) {
                assert.strictEqual(langCompilerMapping.has(language), true, `注释格式表包含未知语言: ${language}`);
            }
        });
    });

    describe("题型映射", () => {
        it("problemTypeInfoMapping 应覆盖全部 ProblemType 枚举值", () => {
            const missing = Object.values(ProblemType).filter((type) => !problemTypeInfoMapping.has(type));
            assert.deepStrictEqual(missing, [], `题型映射缺少: ${missing.join(", ")}`);
        });

        it("题型的数值 type 与 prefix 应唯一", () => {
            const values = [...problemTypeInfoMapping.values()];
            const types = values.map((info) => info.type);
            const prefixes = values.map((info) => info.prefix);

            assert.strictEqual(new Set(types).size, types.length, "存在重复的题型数值");
            assert.strictEqual(new Set(prefixes).size, prefixes.length, "存在重复的题型前缀");
        });

        it("支持的题型应是题型映射的子集", () => {
            for (const type of supportedProblemTypes) {
                assert.strictEqual(problemTypeInfoMapping.has(type), true, `未知的受支持题型: ${type}`);
            }
        });

        it("默认节点中的题型应为合法值", () => {
            assert.strictEqual(
                Object.values(ProblemType).includes(defaultPtaNode.value.problemType),
                true,
                `defaultPtaNode 的题型非法: ${defaultPtaNode.value.problemType}`
            );
        });
    });

    describe("其它常量", () => {
        it("代码配色主题应同时提供亮色与暗色样式表", () => {
            for (const [theme, files] of colorThemeMapping) {
                assert.strictEqual(files.length, 2, `主题 ${theme} 应包含亮/暗两套样式`);
                for (const file of files) {
                    assert.ok(file.endsWith(".css"), `主题 ${theme} 的样式文件应为 css: ${file}`);
                }
            }
        });

        it("ZOJ 题集 ID 应与 searchIndex/constants 保持一致", () => {
            assert.strictEqual(ZOJ_PROBLEM_SET_ID, ZOJ_PROBLEM_SET_ID_FROM_CONSTANTS);
            assert.notStrictEqual(ZOJ_PROBLEM_SET_ID, "");
        });
    });
});
