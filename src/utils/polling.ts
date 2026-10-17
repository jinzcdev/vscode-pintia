/**
 * 顺序轮询工具。
 *
 * 刻意不用 `setInterval`：定时器的清理只写在「成功」那条分支上，而 `httpGet` 失败时
 * 会吞掉异常并返回 `undefined`，此时回调里的 `data.queued` 抛出的 TypeError 既不会
 * 结束外层 Promise，也不会执行 `clearInterval`——轮询会每秒一次永久持续下去。
 *
 * 这里改成 `for` + `await sleep()`：成功、失败、超时三条路径都必然离开循环，
 * 不存在可泄漏的定时器。
 */

/** 默认轮询间隔 */
export const POLL_INTERVAL_MS = 1000;

/**
 * 提交后的轮询次数上限（约 5 分钟，远高于拼题A 的实际评测耗时）。
 *
 * 改造前提交没有上限，接口一旦持续异常就会永久轮询并持续打请求。
 */
export const SUBMISSION_POLL_MAX_ATTEMPTS = 300;

/** 自定义样例测试的轮询上限，与改造前的 60 次一致 */
export const TEST_POLL_MAX_ATTEMPTS = 60;

export interface IPollOptions {
    /** 轮询次数上限。必须显式给出，避免出现无法终止的调用 */
    maxAttempts: number;
    intervalMs?: number;
    /**
     * 等待实现。抽成可注入参数是为了可测：`delay` 是同模块内的直接调用，
     * sinon 无法从外部替换它，而 fake timers 要求用例精确推进时钟。
     */
    sleep?: (ms: number) => Promise<void>;
    timeoutMessage?: string;
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 反复调用 `fetchOnce` 直到 `isDone` 成立。
 *
 * @throws `fetchOnce` 返回空值（接口失败的信号）时立即抛出，不再继续轮询
 * @throws 达到 `maxAttempts` 仍未完成时抛出超时错误
 */
export async function pollUntil<T>(
    fetchOnce: () => Promise<T>,
    isDone: (data: T) => boolean,
    options: IPollOptions
): Promise<T> {
    const { maxAttempts, intervalMs = POLL_INTERVAL_MS, sleep = delay, timeoutMessage = "Polling timed out" } = options;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 保留改造前的语义：先等一个间隔再发首次请求
        await sleep(intervalMs);

        const data = await fetchOnce();
        if (data === undefined || data === null) {
            throw new Error("Polling aborted: the server returned an empty response.");
        }
        if (isDone(data)) {
            return data;
        }
    }

    throw new Error(timeoutMessage);
}
