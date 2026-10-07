import * as assert from "assert";
import { convertChineseCharacters } from "../../../src/utils/chineseUtils";

describe("chineseUtils - convertChineseCharacters", () => {
    it("空串应返回空串", () => {
        assert.strictEqual(convertChineseCharacters(""), "");
    });

    it("无中文时应原样返回", () => {
        assert.strictEqual(convertChineseCharacters("abc"), "abc");
    });

    it("中文标点应转为英文标点", () => {
        assert.strictEqual(convertChineseCharacters("a，b。c（d）"), "a,b.c(d)");
        assert.strictEqual(convertChineseCharacters("～—"), "~-");
        assert.strictEqual(convertChineseCharacters("＃％＆｜／＼￥"), "#%&|/\\$");
    });

    it("中文标点与拼音应同时转换", () => {
        assert.strictEqual(convertChineseCharacters("你好，世界！"), "ni-hao,shi-jie!");
        assert.strictEqual(convertChineseCharacters("（测试）"), "(ce-shi)");
    });

    it("书名号、方括号、省略号等映射应生效", () => {
        assert.strictEqual(convertChineseCharacters("【标题】《书》"), "[biao-ti]<shu>");
        assert.strictEqual(convertChineseCharacters("省略…"), "sheng-lüe...");
    });

    it("应支持自定义拼音分隔符，标点映射不受影响", () => {
        assert.strictEqual(convertChineseCharacters("你好，世界", "_"), "ni_hao,shi_jie");
    });
});
