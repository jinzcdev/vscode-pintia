import * as assert from "assert";
import { convertChineseToPinyin } from "../../../src/utils/pinyinUtils";

describe("pinyinUtils - convertChineseToPinyin", () => {
    it("空串应返回空串", () => {
        assert.strictEqual(convertChineseToPinyin(""), "");
    });

    it("无中文时应原样返回", () => {
        assert.strictEqual(convertChineseToPinyin("Hello World"), "Hello World");
        assert.strictEqual(convertChineseToPinyin("1-1 array.cpp"), "1-1 array.cpp");
    });

    it("连续中文应转为小写拼音，默认以 - 连接", () => {
        assert.strictEqual(convertChineseToPinyin("你好"), "ni-hao");
        assert.strictEqual(convertChineseToPinyin("你好世界"), "ni-hao-shi-jie");
    });

    it("只转换中文片段，其余字符保持原样", () => {
        assert.strictEqual(convertChineseToPinyin("第1章 数组"), "di1zhang shu-zu");
    });

    it("应支持自定义分隔符", () => {
        assert.strictEqual(convertChineseToPinyin("你好", "_"), "ni_hao");
        assert.strictEqual(convertChineseToPinyin("你好", ""), "nihao");
    });

    it("多段中文应分别转换", () => {
        assert.strictEqual(convertChineseToPinyin("数组 链表"), "shu-zu lian-biao");
    });
});
