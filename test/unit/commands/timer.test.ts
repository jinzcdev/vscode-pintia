import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { showTimerMenu, showTimerStats, toggleTimer, toggleTimerForProblem } from "../../../src/commands/timer";
import { IPtaProblem, TimerState } from "../../../src/shared";
import { timerController } from "../../../src/timer/timerController";
import { timerManager } from "../../../src/timer/timerManager";
import { PtaTimerStatsProvider } from "../../../src/webview/PtaTimerStatsProvider";
import { resetVscodeMock } from "../../setup";

const p1: IPtaProblem = { psID: "ps1", pID: "p1", psName: "期末考核", title: "两数之和" };
const p2: IPtaProblem = { psID: "ps1", pID: "p2", psName: "期末考核", title: "数组去重" };

interface MenuItem {
    label: string;
    description?: string;
    detail?: string;
    action: "toggle" | "discard" | "start-current" | "stats";
}

describe("commands/timer", () => {
    let toggleStub: sinon.SinonStub;
    let toggleForStub: sinon.SinonStub;
    let discardStub: sinon.SinonStub;
    let startStub: sinon.SinonStub;
    let getActiveStub: sinon.SinonStub;
    let getCurrentStub: sinon.SinonStub;
    let getStateStub: sinon.SinonStub;
    let getSessionStub: sinon.SinonStub;
    let getAttemptsStub: sinon.SinonStub;
    let quickPickStub: sinon.SinonStub;
    let warningStub: sinon.SinonStub;
    let infoStub: sinon.SinonStub;
    let errorStub: sinon.SinonStub;

    beforeEach(() => {
        resetVscodeMock();
        toggleStub = sinon.stub(timerController, "toggle").resolves(true);
        toggleForStub = sinon.stub(timerController, "toggleFor").resolves();
        discardStub = sinon.stub(timerController, "discardActive").resolves();
        startStub = sinon.stub(timerController, "startCurrentProblem").resolves(true);
        getActiveStub = sinon.stub(timerController, "getActiveProblem").returns(undefined);
        getCurrentStub = sinon.stub(timerController, "getCurrentProblem").returns(undefined);
        getStateStub = sinon.stub(timerManager, "getState").returns(TimerState.Idle);
        getSessionStub = sinon.stub(timerManager, "getSessionSeconds").returns(0);
        getAttemptsStub = sinon.stub(timerManager, "getAttempts").returns([]);

        quickPickStub = vscode.window.showQuickPick as sinon.SinonStub;
        warningStub = vscode.window.showWarningMessage as sinon.SinonStub;
        infoStub = vscode.window.showInformationMessage as sinon.SinonStub;
        errorStub = vscode.window.showErrorMessage as sinon.SinonStub;
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    function menuItems(): MenuItem[] {
        return quickPickStub.firstCall.args[0] as MenuItem[];
    }

    describe("toggleTimer", () => {
        it("没有可计时的题目时应提示", async () => {
            toggleStub.resolves(false);

            await toggleTimer();

            assert.strictEqual(warningStub.calledOnce, true);
            assert.ok(String(warningStub.firstCall.args[0]).includes("not a Pintia problem"));
        });

        it("成功切换时不应打扰用户", async () => {
            await toggleTimer();

            assert.strictEqual(warningStub.called, false);
            assert.strictEqual(infoStub.called, false);
        });

        it("计时器抛错时应弹错误提示而不是崩掉", async () => {
            toggleStub.rejects(new Error("boom"));

            await assert.doesNotReject(() => toggleTimer());
            assert.strictEqual(errorStub.called, true);
        });
    });

    describe("toggleTimerForProblem（CodeLens）", () => {
        it("没有活动计时器时应直接为指定题目开始计时", async () => {
            await toggleTimerForProblem(p1);

            assert.deepStrictEqual(toggleForStub.firstCall.args, [p1]);
            assert.strictEqual(warningStub.called, false);
        });

        it("计时的是同一题时不应弹确认", async () => {
            getActiveStub.returns(p1);

            await toggleTimerForProblem(p1);

            assert.strictEqual(toggleForStub.calledOnce, true);
            assert.strictEqual(warningStub.called, false);
        });

        it("另一题正在计时时应先确认是否丢弃", async () => {
            getActiveStub.returns(p2);
            warningStub.resolves("Start Timing");

            await toggleTimerForProblem(p1);

            const message = String(warningStub.firstCall.args[0]);
            assert.ok(message.includes("数组去重") && message.includes("两数之和"), message);
            assert.deepStrictEqual(toggleForStub.firstCall.args, [p1]);
        });

        it("取消确认时不应切换计时", async () => {
            getActiveStub.returns(p2);
            warningStub.resolves(undefined);

            await toggleTimerForProblem(p1);

            assert.strictEqual(toggleForStub.called, false);
        });

        it("计时器抛错时应弹错误提示", async () => {
            toggleForStub.rejects(new Error("boom"));

            await assert.doesNotReject(() => toggleTimerForProblem(p1));
            assert.strictEqual(errorStub.called, true);
        });
    });

    describe("showTimerMenu", () => {
        it("没有任何题目和记录时应直接提示，不弹空菜单", async () => {
            await showTimerMenu();

            assert.strictEqual(quickPickStub.called, false);
            assert.ok(String(infoStub.firstCall.args[0]).includes("No timing records"));
        });

        it("有活动计时器时应提供暂停、结束与统计", async () => {
            getActiveStub.returns(p1);
            getStateStub.returns(TimerState.Running);
            getSessionStub.returns(90);
            quickPickStub.resolves(undefined);

            await showTimerMenu();

            assert.deepStrictEqual(
                menuItems().map((item) => item.action),
                ["toggle", "discard", "stats"]
            );
            assert.ok(menuItems()[0].label.includes("Pause"), menuItems()[0].label);
            assert.ok(String(menuItems()[0].description).includes("01:30"), menuItems()[0].description);
            assert.strictEqual(quickPickStub.firstCall.args[1].placeHolder, "期末考核 · 两数之和");
        });

        it("已暂停时菜单第一项应为继续", async () => {
            getActiveStub.returns(p1);
            getStateStub.returns(TimerState.Paused);
            getSessionStub.returns(90);
            quickPickStub.resolves(undefined);

            await showTimerMenu();

            assert.ok(menuItems()[0].label.includes("Resume"), menuItems()[0].label);
        });

        it("活动计时器与当前题目不同时应额外提供「为当前题目开始计时」", async () => {
            getActiveStub.returns(p1);
            getCurrentStub.returns(p2);
            getStateStub.returns(TimerState.Running);
            quickPickStub.resolves(undefined);

            await showTimerMenu();

            assert.deepStrictEqual(
                menuItems().map((item) => item.action),
                ["toggle", "discard", "start-current", "stats"]
            );
        });

        it("没有活动计时器时应提供为当前题目开始计时", async () => {
            getCurrentStub.returns(p1);
            quickPickStub.resolves(undefined);

            await showTimerMenu();

            assert.deepStrictEqual(
                menuItems().map((item) => item.action),
                ["start-current", "stats"]
            );
        });

        it("非题目文件但全局有 AC 记录时只提供统计", async () => {
            getAttemptsStub.returns([{}]);
            quickPickStub.resolves(undefined);

            await showTimerMenu();

            assert.deepStrictEqual(
                menuItems().map((item) => item.action),
                ["stats"]
            );
        });

        it("选择暂停/继续应调用 toggle", async () => {
            getActiveStub.returns(p1);
            quickPickStub.onFirstCall().resolves({ action: "toggle" });

            await showTimerMenu();

            assert.strictEqual(toggleStub.calledOnce, true);
        });

        it("确认结束后应丢弃当前计时", async () => {
            getActiveStub.returns(p1);
            quickPickStub.onFirstCall().resolves({ action: "discard" });
            warningStub.resolves("End Timing");

            await showTimerMenu();

            assert.strictEqual(discardStub.calledOnce, true);
            assert.strictEqual(infoStub.calledOnce, true);
        });

        it("取消结束后不应丢弃", async () => {
            getActiveStub.returns(p1);
            quickPickStub.onFirstCall().resolves({ action: "discard" });
            warningStub.resolves(undefined);

            await showTimerMenu();

            assert.strictEqual(discardStub.called, false);
        });

        it("为当前题目开始计时会丢弃另一题时应先确认", async () => {
            getActiveStub.returns(p1);
            getCurrentStub.returns(p2);
            quickPickStub.onFirstCall().resolves({ action: "start-current" });
            warningStub.resolves("Start Timing");

            await showTimerMenu();

            assert.strictEqual(warningStub.calledOnce, true);
            const message = String(warningStub.firstCall.args[0]);
            assert.ok(message.includes("两数之和") && message.includes("数组去重"), message);
            assert.strictEqual(startStub.calledOnce, true);
        });

        it("没有活动计时器时应直接开始，不弹确认", async () => {
            getCurrentStub.returns(p1);
            quickPickStub.onFirstCall().resolves({ action: "start-current" });

            await showTimerMenu();

            assert.strictEqual(warningStub.called, false);
            assert.strictEqual(startStub.calledOnce, true);
        });

        it("选择统计应执行统计命令", async () => {
            getAttemptsStub.returns([{}]);
            quickPickStub.onFirstCall().resolves({ action: "stats" });

            await showTimerMenu();

            assert.deepStrictEqual((vscode.commands.executeCommand as sinon.SinonStub).firstCall.args, [
                "pintia.showTimerStats",
            ]);
        });

        it("结束后抛错时应弹错误提示", async () => {
            getActiveStub.returns(p1);
            quickPickStub.onFirstCall().resolves({ action: "discard" });
            warningStub.resolves("End Timing");
            discardStub.rejects(new Error("boom"));

            await assert.doesNotReject(() => showTimerMenu());
            assert.strictEqual(errorStub.called, true);
        });

        it("开始计时抛错时应弹错误提示", async () => {
            getCurrentStub.returns(p1);
            quickPickStub.onFirstCall().resolves({ action: "start-current" });
            startStub.rejects(new Error("boom"));

            await assert.doesNotReject(() => showTimerMenu());
            assert.strictEqual(errorStub.called, true);
        });
    });

    describe("showTimerStats", () => {
        it("应把全部记录交给统计页并打开", async () => {
            const attempts = [{ submissionId: "s1" }];
            const showStub = sinon.stub().resolves();
            const createStub = sinon
                .stub(PtaTimerStatsProvider, "createOrUpdate")
                .returns({ show: showStub } as unknown as PtaTimerStatsProvider);
            getAttemptsStub.returns(attempts);

            await showTimerStats();

            assert.deepStrictEqual(createStub.firstCall.args, [attempts]);
            assert.strictEqual(showStub.calledOnce, true);
        });
    });
});
