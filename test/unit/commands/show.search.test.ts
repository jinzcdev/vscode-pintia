import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { searchProblem } from "../../../src/commands/show";
import { ptaManager } from "../../../src/ptaManager";
import { ptaCache, PtaLoginMethod } from "../../../src/shared";
import { TELEMETRY_EVENTS } from "../../../src/telemetry/events";
import { telemetryService } from "../../../src/telemetry/telemetryService";
import { createFakeExtensionContext, getTelemetryEvents, resetVscodeMock } from "../../setup";

const TEST_CONNECTION_STRING = "InstrumentationKey=test";
const SEARCH_ITEM = {
    psID: "ps1",
    pID: "p1",
    psName: "SECRET_PROBLEM_SET",
    title: "SECRET_TITLE_123",
    label: "1-1",
    score: 10,
    type: "PROGRAMMING",
};

describe("searchProblem - 搜索埋点", () => {
    beforeEach(async () => {
        resetVscodeMock();
        await telemetryService.resetForTests();
        sinon.stub(ptaManager, "getUserSession").returns({
            id: "u1",
            user: "tester",
            email: "tester@example.com",
            loginMethod: PtaLoginMethod.Cookie,
            cookie: "secret-cookie",
        });
        sinon.stub(ptaCache as unknown as { get: () => unknown }, "get").returns([SEARCH_ITEM]);
        telemetryService.initialize(
            createFakeExtensionContext(),
            () => ptaManager.getUserSession(),
            TEST_CONNECTION_STRING
        );
    });

    afterEach(async () => {
        sinon.restore();
        await telemetryService.resetForTests();
        resetVscodeMock();
    });

    it("取消搜索时应记录 open 与 cancel，且不包含关键词或题目标题", async () => {
        (vscode.window.showQuickPick as sinon.SinonStub).resolves(undefined);

        await searchProblem();

        const events = getTelemetryEvents();
        const open = events.find((item) => item.name === TELEMETRY_EVENTS.SEARCH_OPEN);
        const cancel = events.find((item) => item.name === TELEMETRY_EVENTS.SEARCH_CANCEL);
        assert.ok(open);
        assert.ok(cancel);
        assert.strictEqual(open.properties?.outcome, "ready");
        assert.strictEqual(open.properties?.indexSize, "1");
        assert.strictEqual(cancel.properties?.indexSize, "1");

        const serialized = JSON.stringify(events);
        assert.ok(!serialized.includes("SECRET_TITLE_123"));
        assert.ok(!serialized.includes("SECRET_PROBLEM_SET"));
        assert.ok(!serialized.includes("tester@example.com"));
        assert.ok(!serialized.includes("secret-cookie"));
    });

    it("选中搜索项时应记录 rank 并以 search 来源打开预览", async () => {
        (vscode.window.showQuickPick as sinon.SinonStub).callsFake(async (items: unknown[]) => items[0]);

        await searchProblem();

        const select = getTelemetryEvents().find((item) => item.name === TELEMETRY_EVENTS.SEARCH_SELECT);
        assert.ok(select);
        assert.strictEqual(select.measurements?.rank, 1);
        assert.deepStrictEqual((vscode.commands.executeCommand as sinon.SinonStub).firstCall.args, [
            "pintia.previewProblem",
            "ps1",
            "p1",
            true,
            "search",
        ]);
    });

    it("未登录时应记录 notLoggedIn", async () => {
        (ptaManager.getUserSession as sinon.SinonStub).returns(undefined);

        await searchProblem();

        const open = getTelemetryEvents().find((item) => item.name === TELEMETRY_EVENTS.SEARCH_OPEN);
        assert.ok(open);
        assert.strictEqual(open.properties?.outcome, "notLoggedIn");
    });
});
