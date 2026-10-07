import * as assert from "assert";
import { convertChineseCharacters } from "../../../src/utils/chineseUtils";
import { defaultIfBlank, isValidFileName, sanitizeFileName } from "../../../src/utils/stringUtils";

describe("stringUtils", () => {
    describe("defaultIfBlank", () => {
        it("undefined 时应返回默认值", () => {
            assert.strictEqual(defaultIfBlank(undefined, "fallback"), "fallback");
        });

        it("空串与纯空白应返回默认值", () => {
            assert.strictEqual(defaultIfBlank("", "fallback"), "fallback");
            assert.strictEqual(defaultIfBlank("   ", "fallback"), "fallback");
            assert.strictEqual(defaultIfBlank("\t\n", "fallback"), "fallback");
        });

        it("有内容时应原样返回，不做 trim", () => {
            assert.strictEqual(defaultIfBlank("value", "fallback"), "value");
            assert.strictEqual(defaultIfBlank(" value ", "fallback"), " value ");
        });
    });

    describe("isValidFileName", () => {
        it("普通文件名应有效", () => {
            assert.strictEqual(isValidFileName("1-1 数组.cpp"), true);
            assert.strictEqual(isValidFileName("第1章_数组.py"), true);
        });

        it("空串与纯空白应无效", () => {
            assert.strictEqual(isValidFileName(""), false);
            assert.strictEqual(isValidFileName("   "), false);
        });

        it("包含路径非法字符时应无效", () => {
            for (const invalid of ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]) {
                assert.strictEqual(isValidFileName(`name${invalid}part`), false, `字符 ${invalid} 应被判为非法`);
            }
        });

        it("包含控制字符时应无效", () => {
            assert.strictEqual(isValidFileName("name\u0000part"), false);
            assert.strictEqual(isValidFileName("name\npart"), false);
        });
    });

    describe("sanitizeFileName", () => {
        it("应把全部非法字符替换为下划线", () => {
            assert.strictEqual(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j'), "a_b_c_d_e_f_g_h_i_j");
        });

        it("不含非法字符时应原样返回", () => {
            assert.strictEqual(sanitizeFileName("A1001 Hello World"), "A1001 Hello World");
            assert.strictEqual(sanitizeFileName("第1章_数组.cpp"), "第1章_数组.cpp");
        });

        it("应支持自定义替换符", () => {
            assert.strictEqual(sanitizeFileName("A/B", "-"), "A-B");
        });

        it("替换符为空串时应删除非法字符", () => {
            assert.strictEqual(sanitizeFileName("A/B", ""), "AB");
        });

        it("替换符自身含非法字符或空白时应回退为下划线", () => {
            // 否则等于把非法字符原样放回路径里
            assert.strictEqual(sanitizeFileName("A/B", "/"), "A_B");
            assert.strictEqual(sanitizeFileName("A/B", " "), "A_B");
            assert.strictEqual(sanitizeFileName("A/B", "*"), "A_B");
        });

        it("替换符中的 $ 记法不得被 String.replace 特殊解释", () => {
            // 若用字符串式替换，`$&` 会展开为被匹配的字符，等于净化失效
            assert.strictEqual(sanitizeFileName("A/B", "$&"), "A$&B");
            assert.strictEqual(sanitizeFileName("A/B", "$1"), "A$1B");
        });

        it("空输入应返回空串", () => {
            assert.strictEqual(sanitizeFileName(""), "");
        });

        it("净化中文转写后的结果——顺序回归", () => {
            // convertChineseCharacters 会把全角标点映射回 ASCII 非法字符，
            // 因此净化必须发生在其之后（issue #25 的第二处根因）
            assert.strictEqual(sanitizeFileName(convertChineseCharacters("A／B")), "A_B");
            assert.strictEqual(sanitizeFileName(convertChineseCharacters("A：B")), "A_B");
            assert.strictEqual(sanitizeFileName(convertChineseCharacters("A《B》")), "A_B_");
        });
    });
});
