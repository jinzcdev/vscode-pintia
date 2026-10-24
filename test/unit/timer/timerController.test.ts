import * as assert from "assert";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IPtaProblem, TimerState } from "../../../src/shared";
import { TimerController } from "../../../src/timer/timerController";
import { TimerManager } from "../../../src/timer/timerManager";
import { ITimerStatusBarView } from "../../../src/timer/timerStatusBar";
import { PtaTimerStatsProvider } from "../../../src/webview/PtaTimerStatsProvider";
import { createFakeDocument, setActiveTextEditor } from "../../helpers/vscodeFakes";
import { resetVscodeMock, setConfigValue } from "../../setup";

const PS_NAME = "期末考核";

function problemSource(pID: string, title: string = `题目${pID}`): string {
    return [
        "/*",
        `  @pintia psid=ps1 pid=${pID} compiler=GXX`,
        `  ProblemSet: ${PS_NAME}`,
        `  Title: ${title}`,
        " */",
        "int main() { return 0; }",
    ].join("\n");
}

type FakeView = ITimerStatusBarView & { update: sinon.SinonStub; dispose: sinon.SinonStub };

function createView(): FakeView {
    return { update: sinon.stub(), dispose: sinon.stub() };
}

function lastUpdate(view: FakeView): { problem?: IPtaProblem; visible: boolean } {
    const [problem, visible] = view.update.lastCall.args as [IPtaProblem | undefined, boolean];
    return { problem, visible };
}

describe("timerController - 手动计时与 AC 回调", () => {
    let manager: TimerManager;
    let view: FakeView;
    let controller: TimerController;
    let tempDir: string;
    let filePath: string;
    let clock: sinon.SinonFakeTimers;
    const T0 = new Date("2026-10-17T10:00:00.000Z").getTime();

    function editorListener(): () => void {
        return (vscode.window.onDidChangeActiveTextEditor as sinon.SinonStub).firstCall.args[0];
    }

    function configListener(): (event: { affectsConfiguration: (section: string) => boolean }) => void {
        return (vscode.workspace.onDidChangeConfiguration as sinon.SinonStub).firstCall.args[0];
    }

    function closeListener(): (document: vscode.TextDocument) => Promise<void> {
        return (vscode.workspace.onDidCloseTextDocument as sinon.SinonStub).firstCall.args[0];
    }

    function openProblem(pID: string, title?: string): void {
        setActiveTextEditor({ document: createFakeDocument(problemSource(pID, title)) } as never);
        editorListener()();
    }

    function openNonProblem(): void {
        setActiveTextEditor({ document: createFakeDocument("int main() {}") } as never);
        editorListener()();
    }

    function state(pID: string): TimerState {
        return manager.getState("ps1", pID);
    }

    beforeEach(() => {
        resetVscodeMock();
        clock = sinon.useFakeTimers({ now: T0, toFake: ["Date"] });
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pintia-timer-controller-"));
        filePath = path.join(tempDir, "timer.json");
        manager = new TimerManager(filePath);
        view = createView();
        controller = new TimerController(manager, view);
    });

    afterEach(() => {
        controller.dispose();
        clock.restore();
        resetVscodeMock();
        fs.removeSync(tempDir);
    });

    describe("状态栏显示", () => {
        it("打开题目文件不应自动开始，只显示「计时」", () => {
            openProblem("p1");

            assert.strictEqual(state("p1"), TimerState.Idle, "必须由用户点击才开始");
            assert.strictEqual(lastUpdate(view).problem?.pID, "p1");
            assert.strictEqual(lastUpdate(view).visible, true);
        });

        it("非题目文件应隐藏", () => {
            openNonProblem();

            assert.strictEqual(lastUpdate(view).visible, false);
            assert.strictEqual(lastUpdate(view).problem, undefined);
        });

        it("有活动计时器时切到别的文件也应继续显示该计时器", async () => {
            openProblem("p1", "两数之和");
            await controller.toggle();

            openNonProblem();

            assert.strictEqual(lastUpdate(view).problem?.pID, "p1");
            assert.strictEqual(lastUpdate(view).visible, true);
        });

        it("关闭状态栏显示配置时应隐藏，但不影响计时", async () => {
            openProblem("p1");
            await controller.toggle();
            setConfigValue("timer.enableStatusBar", false);

            configListener()({ affectsConfiguration: (section) => section === "pintia.timer.enableStatusBar" });

            assert.strictEqual(lastUpdate(view).visible, false);
            assert.strictEqual(state("p1"), TimerState.Running);
        });
    });

    describe("toggle", () => {
        it("空闲时应为当前题目开始计时", async () => {
            openProblem("p1");

            assert.strictEqual(await controller.toggle(), true);
            assert.strictEqual(state("p1"), TimerState.Running);
        });

        it("运行中应暂停，暂停后应继续", async () => {
            openProblem("p1");
            await controller.toggle();

            await controller.toggle();
            assert.strictEqual(state("p1"), TimerState.Paused);

            await controller.toggle();
            assert.strictEqual(state("p1"), TimerState.Running);
        });

        it("没有活动计时器且当前不是题目时应返回 false", async () => {
            openNonProblem();

            assert.strictEqual(await controller.toggle(), false);
        });

        it("有活动计时器时应切换它，而不是为当前文件开始新计时", async () => {
            openProblem("p1");
            await controller.toggle();

            openProblem("p2");
            await controller.toggle();

            assert.strictEqual(state("p1"), TimerState.Paused, "切换的是 p1 的活动计时器");
            assert.strictEqual(state("p2"), TimerState.Idle);
        });

        it("暂停状态不应被切换文件自动恢复", async () => {
            openProblem("p1");
            await controller.toggle();
            await controller.toggle();
            assert.strictEqual(state("p1"), TimerState.Paused);

            openNonProblem();
            openProblem("p1");

            assert.strictEqual(state("p1"), TimerState.Paused);
        });
    });

    describe("关闭题目文件", () => {
        it("关闭正在计时的题目应自动暂停并提示", async () => {
            openProblem("p1", "两数之和");
            await controller.toggle();
            clock.tick(60_000);
            const document = vscode.window.activeTextEditor!.document;

            await closeListener()(document);

            assert.strictEqual(state("p1"), TimerState.Paused);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 60);
            const message = String((vscode.window.showInformationMessage as sinon.SinonStub).firstCall.args[0]);
            assert.ok(message.includes("两数之和"), message);
            assert.ok(message.includes("01:00"), message);
        });

        it("关闭其它题目的文档不应影响当前计时", async () => {
            openProblem("p1");
            await controller.toggle();

            await closeListener()(createFakeDocument(problemSource("p2")));

            assert.strictEqual(state("p1"), TimerState.Running);
        });

        it("已暂停时关闭文档不应重复提示", async () => {
            openProblem("p1");
            await controller.toggle();
            await controller.toggle();
            assert.strictEqual(state("p1"), TimerState.Paused);
            const showStub = vscode.window.showInformationMessage as sinon.SinonStub;
            showStub.resetHistory();

            await closeListener()(vscode.window.activeTextEditor!.document);

            assert.strictEqual(state("p1"), TimerState.Paused);
            assert.strictEqual(showStub.called, false);
        });

        it("重新打开后继续应接着原来的秒数走", async () => {
            openProblem("p1");
            await controller.toggle();
            clock.tick(60_000);
            await closeListener()(vscode.window.activeTextEditor!.document);

            openProblem("p1");
            await controller.toggle();
            clock.tick(10_000);

            assert.strictEqual(state("p1"), TimerState.Running);
            assert.strictEqual(manager.getSessionSeconds("ps1", "p1"), 70);
        });
    });

    describe("toggleFor（CodeLens）", () => {
        const target: IPtaProblem = { psID: "ps1", pID: "p1", psName: PS_NAME, title: "两数之和" };

        it("不依赖当前编辑器，可直接为指定题目开始计时", async () => {
            setActiveTextEditor(undefined);

            await controller.toggleFor(target);

            assert.strictEqual(state("p1"), TimerState.Running);
            assert.strictEqual(lastUpdate(view).problem?.pID, "p1");
        });

        it("本题运行中再次点击应暂停", async () => {
            await controller.toggleFor(target);

            await controller.toggleFor(target);

            assert.strictEqual(state("p1"), TimerState.Paused);
        });

        it("本题已暂停时应继续", async () => {
            await controller.toggleFor(target);
            await controller.toggleFor(target);

            await controller.toggleFor(target);

            assert.strictEqual(state("p1"), TimerState.Running);
        });

        it("另一题正在计时时应改为计时指定题目，并丢弃旧会话", async () => {
            await controller.toggleFor({ psID: "ps1", pID: "p2", psName: PS_NAME, title: "数组去重" });
            clock.tick(60_000);

            await controller.toggleFor(target);

            assert.strictEqual(state("p2"), TimerState.Idle);
            assert.strictEqual(state("p1"), TimerState.Running);
            assert.deepStrictEqual(manager.getAttempts(), [], "未 AC 的旧会话不记录");
        });
    });

    describe("菜单动作", () => {
        it("discardActive 应结束计时但不记录", async () => {
            openProblem("p1");
            await controller.toggle();
            clock.tick(60_000);

            await controller.discardActive();

            assert.strictEqual(state("p1"), TimerState.Idle);
            assert.deepStrictEqual(manager.getAttempts(), []);
        });

        it("startCurrentProblem 应为当前题目开始计时", async () => {
            openProblem("p1");

            assert.strictEqual(await controller.startCurrentProblem(), true);
            assert.strictEqual(state("p1"), TimerState.Running);
        });

        it("startCurrentProblem 应丢弃另一题未 AC 的计时", async () => {
            openProblem("p1");
            await controller.startCurrentProblem();
            clock.tick(60_000);

            openProblem("p2");
            await controller.startCurrentProblem();

            assert.strictEqual(state("p1"), TimerState.Idle);
            assert.strictEqual(state("p2"), TimerState.Running);
            assert.deepStrictEqual(manager.getAttempts(), []);
        });
    });

    describe("AC 回调", () => {
        const session = { seconds: 754, psName: PS_NAME, title: "两数之和" };

        it("应记录本次用时、清空计时并弹出恭喜通知", async () => {
            openProblem("p1");
            await controller.toggle();
            clock.tick(754_000);

            const attempt = await controller.handleAccepted("ps1", "p1", "s1", session, "2026-10-17T10:12:34.000Z");

            assert.strictEqual(attempt?.seconds, 754);
            assert.strictEqual(attempt?.acceptedAt, "2026-10-17T10:12:34.000Z");
            assert.strictEqual(state("p1"), TimerState.Idle);
            const message = String((vscode.window.showInformationMessage as sinon.SinonStub).firstCall.args[0]);
            assert.ok(message.includes("Congratulations"), message);
            assert.ok(message.includes("12:34"), message);
        });

        it("0 秒不应记录也不应通知", async () => {
            const attempt = await controller.handleAccepted("ps1", "p1", "s1", { ...session, seconds: 0 });

            assert.strictEqual(attempt, undefined);
            assert.deepStrictEqual(manager.getAttempts(), []);
            assert.strictEqual((vscode.window.showInformationMessage as sinon.SinonStub).called, false);
        });

        it("重复 submissionId 不应重复记录或通知", async () => {
            await controller.handleAccepted("ps1", "p1", "s1", session);
            const second = await controller.handleAccepted("ps1", "p1", "s1", session);

            assert.strictEqual(second, undefined);
            assert.strictEqual(manager.getAttempts().length, 1);
            assert.strictEqual((vscode.window.showInformationMessage as sinon.SinonStub).calledOnce, true);
        });

        it("应静默刷新已打开的统计页", async () => {
            const showStub = sinon.stub().resolves();
            const createStub = sinon
                .stub(PtaTimerStatsProvider, "createOrUpdate")
                .returns({ show: showStub } as unknown as PtaTimerStatsProvider);

            await controller.handleAccepted("ps1", "p1", "s1", session);

            assert.strictEqual(createStub.called, true);
            assert.deepStrictEqual(showStub.firstCall.args, [false]);
        });

        it("点击通知里的「查看答题耗时」应打开统计页", async () => {
            (vscode.window.showInformationMessage as sinon.SinonStub).resolves("Show Time Spent");

            await controller.handleAccepted("ps1", "p1", "s1", session);
            // 通知是 fire-and-forget，等它的 await 续体跑完
            await new Promise((resolve) => setImmediate(resolve));

            assert.deepStrictEqual((vscode.commands.executeCommand as sinon.SinonStub).firstCall.args, [
                "pintia.showTimerStats",
            ]);
        });
    });
});
