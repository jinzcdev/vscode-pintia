import * as assert from "assert";
import * as sinon from "sinon";
import { pollUntil } from "../../../src/utils/polling";

/** 不真正等待的 sleep，让用例无需推进时钟 */
const noSleep = async (): Promise<void> => {};

interface IPollData {
    done: boolean;
}

describe("polling - pollUntil", () => {
    it("成功条件满足时应返回结果并停止轮询", async () => {
        let calls = 0;
        const fetchOnce = async (): Promise<IPollData> => {
            calls += 1;
            return { done: calls >= 2 };
        };

        const result = await pollUntil(fetchOnce, (d) => d.done, { maxAttempts: 5, sleep: noSleep });

        assert.deepStrictEqual(result, { done: true });
        assert.strictEqual(calls, 2, "条件满足后不应继续轮询");
    });

    it("轮询返回空值时应立即失败，不再继续请求", async () => {
        // httpGet 失败时会吞掉异常并返回 undefined，这是「接口坏了」的信号
        let calls = 0;
        const fetchOnce = async (): Promise<IPollData | undefined> => {
            calls += 1;
            return undefined;
        };

        await assert.rejects(
            pollUntil(fetchOnce, () => true, { maxAttempts: 5, sleep: noSleep }),
            /empty response/
        );
        assert.strictEqual(calls, 1, "接口失败后不应继续轮询");
    });

    it("轮询返回 null 时应同样立即失败", async () => {
        let calls = 0;
        const fetchOnce = async (): Promise<IPollData | null> => {
            calls += 1;
            return null;
        };

        await assert.rejects(
            pollUntil(fetchOnce, () => true, { maxAttempts: 5, sleep: noSleep }),
            /empty response/
        );
        assert.strictEqual(calls, 1);
    });

    it("达到次数上限时应抛出超时错误", async () => {
        let calls = 0;
        const fetchOnce = async (): Promise<IPollData> => {
            calls += 1;
            return { done: false };
        };

        await assert.rejects(
            pollUntil(fetchOnce, (d) => d.done, {
                maxAttempts: 3,
                sleep: noSleep,
                timeoutMessage: "Submission timeout",
            }),
            /Submission timeout/
        );
        assert.strictEqual(calls, 3, "应恰好轮询到上限次数");
    });

    it("fetchOnce 抛错时应向上冒泡，且不再轮询", async () => {
        let calls = 0;
        const fetchOnce = async (): Promise<IPollData> => {
            calls += 1;
            throw new Error("boom");
        };

        await assert.rejects(
            pollUntil(fetchOnce, () => true, { maxAttempts: 5, sleep: noSleep }),
            /boom/
        );
        assert.strictEqual(calls, 1);
    });

    it("每次请求前都应等待一个轮询间隔", async () => {
        const sleep = sinon.stub().resolves();
        const fetchOnce = async (): Promise<IPollData> => ({ done: true });

        await pollUntil(fetchOnce, (d) => d.done, { maxAttempts: 5, intervalMs: 250, sleep });

        assert.strictEqual(sleep.callCount, 1);
        assert.strictEqual(sleep.firstCall.args[0], 250);
    });

    it("未完成时应按间隔反复等待", async () => {
        const sleep = sinon.stub().resolves();
        let calls = 0;
        const fetchOnce = async (): Promise<IPollData> => {
            calls += 1;
            return { done: calls >= 3 };
        };

        await pollUntil(fetchOnce, (d) => d.done, { maxAttempts: 5, sleep });

        assert.strictEqual(sleep.callCount, 3);
    });
});
