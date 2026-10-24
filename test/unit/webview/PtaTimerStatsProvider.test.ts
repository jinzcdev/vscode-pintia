import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { setGlobalContext } from "../../../src/globalContext";
import { ITimerAttempt } from "../../../src/shared";
import { PtaTimerStatsProvider } from "../../../src/webview/PtaTimerStatsProvider";
import { resetVscodeMock } from "../../setup";

function attempt(overrides: Partial<ITimerAttempt>): ITimerAttempt {
    return {
        submissionId: "s1",
        psID: "ps1",
        pID: "p1",
        psName: "期末考核",
        title: "两数之和",
        seconds: 60,
        acceptedAt: "2026-10-17T10:00:00.000Z",
        ...overrides,
    };
}

describe("PtaTimerStatsProvider - 交互式统计页", () => {
    let capturedPanel: {
        webview: { html: string; onDidReceiveMessage: sinon.SinonStub };
    };
    let panelCreated: boolean;

    async function renderHtml(attempts: ITimerAttempt[]): Promise<string> {
        const panelStub = vscode.window.createWebviewPanel as sinon.SinonStub;
        await PtaTimerStatsProvider.createOrUpdate(attempts).show();
        if (panelStub.called) {
            capturedPanel = panelStub.lastCall.returnValue;
            panelCreated = true;
        }
        assert.ok(panelCreated, "webview 面板从未被创建");
        return capturedPanel.webview.html;
    }

    function messageHandler(): (msg: unknown) => Promise<void> {
        const call = capturedPanel.webview.onDidReceiveMessage.firstCall;
        return (call.args[0] as (msg: unknown) => Promise<void>).bind(call.args[1]);
    }

    beforeEach(() => {
        resetVscodeMock();
        setGlobalContext({ extensionUri: vscode.Uri.file("/ext") } as never);
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("没有记录时应显示空状态与说明", async () => {
        const html = await renderHtml([]);

        assert.ok(html.includes("No accepted attempts yet."), html);
        assert.ok(html.includes("Start timing before solving a problem"), html);
    });

    it("每道题应生成一张可展开的卡片，并显示最近用时与次数", async () => {
        const html = await renderHtml([
            attempt({ submissionId: "s1", seconds: 300, acceptedAt: "2026-10-15T10:00:00.000Z" }),
            attempt({ submissionId: "s2", seconds: 754, acceptedAt: "2026-10-17T10:00:00.000Z" }),
            attempt({
                submissionId: "s3",
                pID: "p2",
                title: "数组去重",
                seconds: 120,
                acceptedAt: "2026-10-16T10:00:00.000Z",
            }),
        ]);

        assert.strictEqual((html.match(/class="problem-card"/g) ?? []).length, 2, "每道题一张卡片");
        assert.ok(html.includes("12:34"), "最近一次用时");
        assert.ok(html.includes("02:00"), "另一题最近一次用时");
        assert.ok(html.includes("×2"), "同一题多次 AC 应标注次数");
        assert.ok(html.includes('class="problem-detail"'), html);
        assert.ok(html.includes("hidden"), "详情默认折叠");
    });

    it("卡片应带题目预览入口", async () => {
        const html = await renderHtml([attempt({})]);

        assert.ok(html.includes('data-psid="ps1"'), html);
        assert.ok(html.includes('data-pid="p1"'), html);
        assert.ok(html.includes("Open Problem"), html);
    });

    it("有多次 AC 时应绘制趋势折线图与数据点", async () => {
        const html = await renderHtml([
            attempt({ submissionId: "s1", seconds: 600, acceptedAt: "2026-10-15T10:00:00.000Z" }),
            attempt({ submissionId: "s2", seconds: 500, acceptedAt: "2026-10-16T10:00:00.000Z" }),
            attempt({ submissionId: "s3", seconds: 300, acceptedAt: "2026-10-17T10:00:00.000Z" }),
        ]);

        assert.ok(html.includes('class="chart-line"'), "应绘制折线");
        assert.strictEqual((html.match(/class="chart-dot"/g) ?? []).length, 3, "每次 AC 一个数据点");
        assert.ok(html.includes("10:00") && html.includes("05:00"), "应显示 Y 轴用时刻度");
    });

    it("越来越快应标识为 improving，并给出提升百分比", async () => {
        const html = await renderHtml([
            attempt({ submissionId: "s1", seconds: 600, acceptedAt: "2026-10-15T10:00:00.000Z" }),
            attempt({ submissionId: "s2", seconds: 300, acceptedAt: "2026-10-17T10:00:00.000Z" }),
        ]);

        assert.ok(html.includes("sparkline improving"), html);
        assert.ok(html.includes("trend-chart improving"), html);
        assert.ok(html.includes("Faster than the first attempt by 50%"), html);
    });

    it("越来越慢应标识为 worsening", async () => {
        const html = await renderHtml([
            attempt({ submissionId: "s1", seconds: 300, acceptedAt: "2026-10-15T10:00:00.000Z" }),
            attempt({ submissionId: "s2", seconds: 600, acceptedAt: "2026-10-17T10:00:00.000Z" }),
        ]);

        assert.ok(html.includes("sparkline worsening"), html);
        assert.ok(html.includes("trend-chart worsening"), html);
        assert.ok(html.includes("Slower than the first attempt by 100%"), html);
    });

    it("按题目集分块展示，最近的题集在前", async () => {
        const html = await renderHtml([
            attempt({
                submissionId: "s1",
                psName: "期末考核",
                pID: "p1",
                title: "两数之和",
                acceptedAt: "2026-10-15T10:00:00.000Z",
            }),
            attempt({
                submissionId: "s2",
                psName: "练习集",
                pID: "p2",
                title: "数组去重",
                acceptedAt: "2026-10-18T10:00:00.000Z",
            }),
        ]);

        assert.strictEqual((html.match(/class="problem-set-block"/g) ?? []).length, 2, "每个题集一个分块");
        assert.ok(html.includes("1 problems · 1 AC records"), html);
        assert.ok(html.indexOf("练习集") < html.indexOf("期末考核"), "最近练过的题集应排在前面");
    });

    it("只有一次 AC 时应提示暂无趋势，且只提示一次", async () => {
        const html = await renderHtml([attempt({})]);

        assert.strictEqual((html.match(/No trend yet \(only one AC\)\./g) ?? []).length, 1);
        assert.ok(!html.includes('class="chart-line"'), "单次 AC 不应画折线");
    });

    it("明细应新记录在前，并标出与上一次的变化", async () => {
        const html = await renderHtml([
            attempt({ submissionId: "s1", seconds: 600, acceptedAt: "2026-10-15T10:00:00.000Z" }),
            attempt({ submissionId: "s2", seconds: 500, acceptedAt: "2026-10-16T10:00:00.000Z" }),
            attempt({ submissionId: "s3", seconds: 300, acceptedAt: "2026-10-17T10:00:00.000Z" }),
        ]);

        assert.ok(html.includes("AC records (newest first)"), html);
        assert.ok(html.includes("−03:20"), "最新一次比上一次快 3:20");
        assert.ok(html.includes("−01:40"), "第二次比首次快 1:40");
    });

    it("题目名与题集名应做 HTML 转义", async () => {
        const html = await renderHtml([
            attempt({
                title: '<img src=x onerror="alert(1)">',
                psName: "<script>alert(2)</script>",
            }),
        ]);

        assert.ok(!html.includes('<img src=x onerror="alert(1)">'), html);
        assert.ok(!html.includes("<script>alert(2)</script>"), html);
        assert.ok(html.includes("&lt;img"), html);
    });

    it("应加载带 nonce 的交互脚本", async () => {
        const html = await renderHtml([attempt({})]);

        assert.ok(html.includes("timerStats.js"), html);
        assert.ok(/<script nonce="[^"]+" src="[^"]*timerStats\.js"><\/script>/.test(html), html);
    });

    it("点击题目预览应执行 pintia.previewProblem", async () => {
        await renderHtml([attempt({})]);

        await messageHandler()({
            type: "command",
            value: "pintia.previewProblem",
            args: ["ps1", "p1"],
        });

        assert.deepStrictEqual((vscode.commands.executeCommand as sinon.SinonStub).firstCall.args, [
            "pintia.previewProblem",
            "ps1",
            "p1",
            false,
        ]);
    });
});
