import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IPtaProblem } from "../../../src/shared";
import { TimerManager } from "../../../src/timer/timerManager";
import { TimerStatusBar } from "../../../src/timer/timerStatusBar";
import { resetVscodeMock } from "../../setup";

const problem: IPtaProblem = { psID: "ps1", pID: "p1", psName: "期末考核", title: "两数之和" };

/** 取当前创建出来的状态栏项（mock 会记录每次调用） */
function statusBarItem(): {
    text: string;
    tooltip: unknown;
    command?: string;
    show: sinon.SinonStub;
    hide: sinon.SinonStub;
} {
    const stub = vscode.window.createStatusBarItem as sinon.SinonStub;
    return stub.lastCall.returnValue;
}

describe("timerStatusBar - 纯视图", () => {
    let manager: TimerManager;
    let clock: sinon.SinonFakeTimers;
    let statusBar: TimerStatusBar;
    let tempDir: string;
    const T0 = new Date("2026-10-17T10:00:00.000Z").getTime();

    beforeEach(() => {
        resetVscodeMock();
        clock = sinon.useFakeTimers({ now: T0, toFake: ["Date", "setInterval", "clearInterval"] });
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pintia-timer-statusbar-"));
        manager = new TimerManager(path.join(tempDir, "timer.json"));
        statusBar = new TimerStatusBar(manager);
    });

    afterEach(() => {
        statusBar.dispose();
        sinon.restore();
        resetVscodeMock();
        fs.removeSync(tempDir);
    });

    it("应把单击绑定到 toggle 命令", () => {
        assert.strictEqual(statusBarItem().command, "pintia.toggleTimer");
    });

    it("没有当前题目时应隐藏", () => {
        statusBar.update(undefined, true);

        assert.strictEqual(statusBarItem().hide.called, true);
        assert.strictEqual(statusBarItem().show.called, false);
    });

    it("配置关闭可见性时应隐藏", () => {
        statusBar.update(problem, false);

        assert.strictEqual(statusBarItem().hide.called, true);
        assert.strictEqual(statusBarItem().show.called, false);
    });

    it("空闲时显示「计时」", () => {
        statusBar.update(problem, true);

        assert.strictEqual(statusBarItem().show.called, true);
        assert.ok(
            statusBarItem().text.includes("Timer") || statusBarItem().text.includes("计时"),
            statusBarItem().text
        );
    });

    it("运行中应显示题目名、本次秒数，并在每秒 tick 后更新", async () => {
        await manager.start(problem);
        statusBar.update(problem, true);

        assert.ok(statusBarItem().text.includes("两数之和"), `应显示题目名: ${statusBarItem().text}`);
        assert.ok(statusBarItem().text.includes("00:00"), statusBarItem().text);

        await clock.tickAsync(65_000);

        assert.ok(statusBarItem().text.includes("01:05"), `tick 后应显示 01:05，实际: ${statusBarItem().text}`);
    });

    it("暂停后应停止 tick，秒数不再增长", async () => {
        await manager.start(problem);
        statusBar.update(problem, true);
        await clock.tickAsync(30_000);
        await manager.pause(problem.psID, problem.pID);

        statusBar.update(problem, true);
        const paused = statusBarItem().text;
        await clock.tickAsync(60_000);

        assert.strictEqual(statusBarItem().text, paused, "暂停后不应再刷新秒数");
        assert.ok(paused.includes("00:30"), paused);
        assert.ok(paused.includes("两数之和"), `暂停时也应显示题目名: ${paused}`);
    });

    it("超长题目名应截断，完整名称仍在 tooltip 里", async () => {
        const longTitle = "这是一个非常非常非常非常非常非常长的题目名称";
        const longProblem = { ...problem, title: longTitle };
        await manager.start(longProblem);
        statusBar.update(longProblem, true);

        assert.ok(statusBarItem().text.includes("…"), statusBarItem().text);
        assert.ok(!statusBarItem().text.includes(longTitle), "状态栏不应塞入完整长标题");
        const tooltip = statusBarItem().tooltip as vscode.MarkdownString;
        assert.ok(tooltip.value.includes(longTitle), "tooltip 应保留完整题目名");
    });

    it("tooltip 应带本次用时、题目与题集名", async () => {
        await manager.start(problem);
        statusBar.update(problem, true);

        const tooltip = statusBarItem().tooltip as vscode.MarkdownString;

        assert.ok(tooltip.value.includes("This session"), tooltip.value);
        assert.ok(tooltip.value.includes("期末考核"), tooltip.value);
        assert.ok(tooltip.value.includes("两数之和"), tooltip.value);
    });

    it("有历史 AC 时应显示上次 AC 用时", async () => {
        await manager.recordAccepted({
            submissionId: "s1",
            psID: "ps1",
            pID: "p1",
            psName: "期末考核",
            title: "两数之和",
            seconds: 754,
            acceptedAt: "2026-10-17T09:00:00.000Z",
        });

        statusBar.update(problem, true);

        const tooltip = statusBarItem().tooltip as vscode.MarkdownString;
        assert.ok(tooltip.value.includes("Last AC"), tooltip.value);
        assert.ok(tooltip.value.includes("12:34"), tooltip.value);
    });

    it("没有历史 AC 时提示尚无通过记录", () => {
        statusBar.update(problem, true);

        const tooltip = statusBarItem().tooltip as vscode.MarkdownString;
        assert.ok(tooltip.value.includes("No accepted record"), tooltip.value);
    });

    it("tooltip 只放行计时菜单命令", async () => {
        await manager.start(problem);
        statusBar.update(problem, true);

        const tooltip = statusBarItem().tooltip as vscode.MarkdownString;

        assert.deepStrictEqual((tooltip.isTrusted as { enabledCommands: string[] }).enabledCommands, [
            "pintia.timerMenu",
        ]);
        assert.ok(tooltip.value.includes("pintia.timerMenu"));
        assert.ok(!tooltip.value.includes("pintia.showTimerStats"));
    });

    it("三态提示语应随状态变化", async () => {
        statusBar.update(problem, true);
        let tooltip = statusBarItem().tooltip as vscode.MarkdownString;
        assert.ok(tooltip.value.includes("Click to start"), tooltip.value);

        await manager.start(problem);
        statusBar.update(problem, true);
        tooltip = statusBarItem().tooltip as vscode.MarkdownString;
        assert.ok(tooltip.value.includes("Click to pause"), tooltip.value);

        await manager.pause(problem.psID, problem.pID);
        statusBar.update(problem, true);
        tooltip = statusBarItem().tooltip as vscode.MarkdownString;
        assert.ok(tooltip.value.includes("Click to resume"), tooltip.value);
    });

    it("dispose 后不应再 tick", async () => {
        await manager.start(problem);
        statusBar.update(problem, true);
        await clock.tickAsync(5_000);
        const before = statusBarItem().text;

        statusBar.dispose();
        await clock.tickAsync(10_000);

        assert.strictEqual(statusBarItem().text, before);
    });
});
