import * as assert from "assert";
import { defaultIfBlank, isValidFileName } from "../../../src/utils/stringUtils";

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
    });
});
