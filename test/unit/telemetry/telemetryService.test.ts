import * as assert from "assert";
import * as vscode from "vscode";
import type { IUserSession } from "../../../src/entity/userLoginSession";
import { PtaLoginMethod } from "../../../src/shared";
import { TELEMETRY_EVENTS } from "../../../src/telemetry/events";
import { telemetryService } from "../../../src/telemetry/telemetryService";
import { createFakeExtensionContext, getTelemetryEvents, resetVscodeMock, setConfigValue } from "../../setup";

const TEST_CONNECTION_STRING = "InstrumentationKey=test";

function createSession(): IUserSession {
    return {
        id: "u1",
        user: "tester",
        email: "tester@example.com",
        loginMethod: PtaLoginMethod.WeChat,
        cookie: "secret-cookie",
    };
}

describe("telemetryService - 匿名埋点", () => {
    beforeEach(async () => {
        resetVscodeMock();
        await telemetryService.resetForTests();
    });

    afterEach(async () => {
        await telemetryService.resetForTests();
    });

    it("非生产模式不发送事件", () => {
        telemetryService.initialize(
            createFakeExtensionContext({ extensionMode: vscode.ExtensionMode.Development }),
            () => undefined,
            TEST_CONNECTION_STRING
        );

        telemetryService.trackEvent(TELEMETRY_EVENTS.COMMAND, { command: "openPintiaHome" });

        assert.deepStrictEqual(getTelemetryEvents(), []);
    });

    it("VS Code 全局遥测关闭时不发送", () => {
        (vscode.env as unknown as { isTelemetryEnabled: boolean }).isTelemetryEnabled = false;
        telemetryService.initialize(createFakeExtensionContext(), () => undefined, TEST_CONNECTION_STRING);

        telemetryService.trackEvent(TELEMETRY_EVENTS.COMMAND, { command: "openPintiaHome" });

        assert.deepStrictEqual(getTelemetryEvents(), []);
    });

    it("pintia.telemetry.enabled 为 false 时不发送", () => {
        setConfigValue("telemetry.enabled", false);
        telemetryService.initialize(createFakeExtensionContext(), () => undefined, TEST_CONNECTION_STRING);

        telemetryService.trackEvent(TELEMETRY_EVENTS.COMMAND, { command: "openPintiaHome" });

        assert.deepStrictEqual(getTelemetryEvents(), []);
    });

    it("事件自动附带匿名安装 ID 与登录态", () => {
        telemetryService.initialize(createFakeExtensionContext(), createSession, TEST_CONNECTION_STRING);

        telemetryService.trackEvent(TELEMETRY_EVENTS.SESSION_START);

        const [event] = getTelemetryEvents();
        assert.strictEqual(event.name, TELEMETRY_EVENTS.SESSION_START);
        assert.ok(typeof event.properties?.installId === "string" && event.properties.installId.length > 0);
        assert.strictEqual(event.properties?.isLoggedIn, "true");
        assert.strictEqual(event.properties?.loginMethod, PtaLoginMethod.WeChat);

        const serialized = JSON.stringify(event);
        assert.ok(!serialized.includes("secret-cookie"));
        assert.ok(!serialized.includes("tester@example.com"));
        assert.ok(!serialized.includes("tester"));
    });

    it("敏感属性会被过滤", () => {
        telemetryService.initialize(createFakeExtensionContext(), () => undefined, TEST_CONNECTION_STRING);

        telemetryService.trackEvent(TELEMETRY_EVENTS.COMMAND, {
            command: "ok",
            cookie: "secret",
            code: "int main()",
            filePath: "/tmp/main.cpp",
        });

        const [event] = getTelemetryEvents();
        assert.strictEqual(event.properties?.command, "ok");
        assert.ok(!("cookie" in (event.properties ?? {})));
        assert.ok(!("code" in (event.properties ?? {})));
        assert.ok(!("filePath" in (event.properties ?? {})));
    });

    it("错误事件不包含 message 与 stack", () => {
        telemetryService.initialize(createFakeExtensionContext(), () => undefined, TEST_CONNECTION_STRING);

        telemetryService.trackError(TELEMETRY_EVENTS.ERROR, new Error("secret failure message"), {
            command: "submitSolution",
        });

        const [event] = getTelemetryEvents();
        assert.strictEqual(event.properties?.errorName, "Error");
        assert.strictEqual(event.properties?.command, "submitSolution");
        const serialized = JSON.stringify(event);
        assert.ok(!serialized.includes("secret failure message"));
        assert.ok(!serialized.includes("stack"));
    });
});
