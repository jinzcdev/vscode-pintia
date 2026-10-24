import * as assert from "assert";
import { formatDuration } from "../../../src/utils/durationUtils";

describe("durationUtils - formatDuration", () => {
    it("不足一小时应输出 MM:SS", () => {
        assert.strictEqual(formatDuration(0), "00:00");
        assert.strictEqual(formatDuration(5), "00:05");
        assert.strictEqual(formatDuration(65), "01:05");
        assert.strictEqual(formatDuration(754), "12:34");
        assert.strictEqual(formatDuration(3599), "59:59");
    });

    it("满一小时应输出 H:MM:SS", () => {
        assert.strictEqual(formatDuration(3600), "1:00:00");
        assert.strictEqual(formatDuration(3903), "1:05:03");
        assert.strictEqual(formatDuration(36000), "10:00:00");
    });

    it("小数应向下取整", () => {
        assert.strictEqual(formatDuration(65.9), "01:05");
    });

    it("负数与非有限数应按 0 处理", () => {
        // 时钟回拨等异常输入不应显示成负时长
        assert.strictEqual(formatDuration(-10), "00:00");
        assert.strictEqual(formatDuration(NaN), "00:00");
        assert.strictEqual(formatDuration(Infinity), "00:00");
    });
});
