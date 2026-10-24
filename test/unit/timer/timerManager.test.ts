import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import { ITimerFile, TimerState } from "../../../src/shared";
import { TimerManager } from "../../../src/timer/timerManager";

/**
 * 计时口径：只累计 Running 的时间，暂停期间不动；
 * 只有 AC 才落一条 attempt，不做按题累加。
 */
describe("timerManager - 手动计时与 AC 记录", () => {
    let tempDir: string;
    let filePath: string;

    /** 时钟起点，便于断言精确秒数 */
    let clock: sinon.SinonFakeTimers;
    const T0 = new Date("2026-10-17T10:00:00.000Z").getTime();

    const p1 = { psID: "ps1", pID: "p1", title: "两数之和", psName: "期末考核" };
    const p2 = { psID: "ps1", pID: "p2", title: "数组去重", psName: "期末考核" };

    function createManager(): TimerManager {
        return new TimerManager(filePath);
    }

    function readFile(): ITimerFile {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    /** 把时钟往前推 n 秒 */
    function advance(seconds: number): void {
        clock.tick(seconds * 1000);
    }

    function attempt(submissionId: string, seconds: number, acceptedAt: string) {
        return {
            submissionId,
            psID: "ps1",
            pID: "p1",
            psName: "期末考核",
            title: "两数之和",
            seconds,
            acceptedAt,
        };
    }

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pintia-timer-"));
        filePath = path.join(tempDir, "timer.json");
        clock = sinon.useFakeTimers({ now: T0, toFake: ["Date"] });
    });

    afterEach(() => {
        clock.restore();
        fs.removeSync(tempDir);
    });

    describe("基本流转", () => {
        it("初始应为空闲且无 AC 记录", () => {
            const manager = createManager();

            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Idle);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 0);
            assert.deepStrictEqual(manager.getAttempts(), []);
        });

        it("开始后应为运行中，并按墙钟推进", async () => {
            const manager = createManager();

            await manager.start(p1);
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Running);

            advance(90);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 90);
        });

        it("暂停后应停表，继续后接着走", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(60);

            await manager.pause("ps1", "p1");
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Paused);

            advance(600);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 60, "暂停期间不应计时");

            await manager.resume("ps1", "p1");
            advance(30);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 90);
        });

        it("toggle 应依次开始、暂停、继续", async () => {
            const manager = createManager();

            await manager.toggle(p1);
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Running);

            await manager.toggle(p1);
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Paused);

            await manager.toggle(p1);
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Running);
        });

        it("同一时刻只保留一个计时器，开始新题会丢弃旧会话", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(100);

            await manager.start(p2);

            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Idle);
            assert.strictEqual(manager.getState("ps1", "p2"), TimerState.Running);
            assert.deepStrictEqual(manager.getAttempts(), [], "未 AC 的旧会话不记录");
        });

        it("discardActive 应清空计时但不产生记录", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(60);

            await manager.discardActive();

            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Idle);
            assert.deepStrictEqual(manager.getAttempts(), []);
        });
    });

    describe("提交时快照", () => {
        it("应为正在计时的题返回快照", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(90);

            assert.deepStrictEqual(manager.getActiveSession("ps1", "p1"), {
                seconds: 90,
                psName: "期末考核",
                title: "两数之和",
            });
        });

        it("暂停时快照应停在累计秒数", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(60);
            await manager.pause("ps1", "p1");
            advance(600);

            assert.strictEqual(manager.getActiveSession("ps1", "p1")?.seconds, 60);
        });

        it("未计时或计时的是另一题时应返回 undefined", async () => {
            const manager = createManager();

            assert.strictEqual(manager.getActiveSession("ps1", "p1"), undefined);

            await manager.start(p1);
            assert.strictEqual(manager.getActiveSession("ps1", "p2"), undefined);
        });
    });

    describe("AC 记录", () => {
        it("应追加记录并清空匹配的计时器", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(754);

            const record = await manager.recordAccepted({
                submissionId: "s1",
                psID: "ps1",
                pID: "p1",
                psName: "期末考核",
                title: "两数之和",
                seconds: 754,
            });

            assert.strictEqual(record?.seconds, 754);
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Idle);
            assert.strictEqual(manager.getAttempts().length, 1);
        });

        it("同一 submissionId 不应重复记录", async () => {
            const manager = createManager();

            const first = await manager.recordAccepted(attempt("s1", 60, "2026-10-17T10:00:00.000Z"));
            const second = await manager.recordAccepted(attempt("s1", 60, "2026-10-17T10:00:00.000Z"));

            assert.ok(first);
            assert.strictEqual(second, undefined);
            assert.strictEqual(manager.getAttempts().length, 1);
        });

        it("0 秒不应记录", async () => {
            const manager = createManager();

            const record = await manager.recordAccepted(attempt("s1", 0, "2026-10-17T10:00:00.000Z"));

            assert.strictEqual(record, undefined);
            assert.deepStrictEqual(manager.getAttempts(), []);
        });

        it("记录另一题时不应影响当前计时器", async () => {
            const manager = createManager();
            await manager.start(p1);
            advance(60);

            await manager.recordAccepted({
                ...attempt("s2", 30, "2026-10-17T10:00:00.000Z"),
                pID: "p2",
                title: "数组去重",
            });

            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Running);
        });

        it("应按提交时间倒序，并取每题最近一次", async () => {
            const manager = createManager();
            await manager.recordAccepted(attempt("s1", 60, "2026-10-15T10:00:00.000Z"));
            await manager.recordAccepted(attempt("s2", 90, "2026-10-17T10:00:00.000Z"));

            assert.deepStrictEqual(
                manager.getAttempts().map((item) => item.submissionId),
                ["s2", "s1"]
            );
            assert.strictEqual(manager.getLatestAttempt("ps1", "p1")?.submissionId, "s2");
        });
    });

    describe("持久化", () => {
        it("构造时不应创建文件", () => {
            createManager();

            assert.strictEqual(fs.existsSync(filePath), false);
        });

        it("AC 后应落盘，且不残留临时文件", async () => {
            const manager = createManager();
            await manager.recordAccepted(attempt("s1", 60, "2026-10-17T10:00:00.000Z"));

            assert.doesNotThrow(() => readFile());
            assert.strictEqual(fs.existsSync(`${filePath}.tmp`), false);
            assert.strictEqual(readFile().attempts[0].seconds, 60);
            assert.strictEqual(readFile().version, 2);
        });

        it("重新加载应读回 AC 记录", async () => {
            const first = createManager();
            await first.recordAccepted(attempt("s1", 60, "2026-10-17T10:00:00.000Z"));

            const second = createManager();

            assert.strictEqual(second.getAttempts().length, 1);
            assert.strictEqual(second.getAttempts()[0].submissionId, "s1");
        });

        it("重载后运行中的计时器应恢复为「已暂停」，不把关闭期间算进去", async () => {
            const first = createManager();
            await first.start(p1);
            advance(100);
            await first.dispose();

            advance(3600 * 10);
            const second = createManager();

            assert.strictEqual(second.getState("ps1", "p1"), TimerState.Paused);
            assert.strictEqual(second.getSessionSeconds("ps1", "p1"), 100);
        });

        it("恢复为已暂停后继续，应接着原来的秒数走", async () => {
            const first = createManager();
            await first.start(p1);
            advance(100);
            await first.dispose();

            const second = createManager();
            await second.resume("ps1", "p1");
            advance(20);

            assert.strictEqual(second.getSessionSeconds("ps1", "p1"), 120);
        });

        it("v1 的累计 records 应被忽略，但 active 仍可恢复", async () => {
            fs.writeJsonSync(filePath, {
                version: 1,
                records: {
                    "ps1|p1": {
                        psID: "ps1",
                        pID: "p1",
                        psName: "期末考核",
                        title: "两数之和",
                        totalSeconds: 600,
                        sessions: 3,
                        lastSeconds: 200,
                        lastStoppedAt: "2026-10-17T09:00:00.000Z",
                    },
                },
                active: {
                    psID: "ps1",
                    pID: "p1",
                    psName: "期末考核",
                    title: "两数之和",
                    startedAt: T0,
                    elapsedBeforeStart: 30,
                },
            });

            const manager = createManager();

            assert.deepStrictEqual(manager.getAttempts(), [], "累计值无法还原成每次 AC");
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Paused);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 30);
        });

        it("文件损坏时应降级为空记录而不是抛错", () => {
            fs.writeFileSync(filePath, "{not-json");

            const manager = createManager();

            assert.deepStrictEqual(manager.getAttempts(), []);
            assert.strictEqual(manager.getState("ps1", "p1"), TimerState.Idle);
        });
    });
});
