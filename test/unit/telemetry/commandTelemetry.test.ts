import * as assert from "assert";
import { registerCommandWithTelemetry } from "../../../src/telemetry/commandTelemetry";
import { TELEMETRY_EVENTS } from "../../../src/telemetry/events";
import { telemetryService } from "../../../src/telemetry/telemetryService";
import { createFakeExtensionContext, getRegisteredCommand, getTelemetryEvents, resetVscodeMock } from "../../setup";

const TEST_CONNECTION_STRING = "InstrumentationKey=test";

describe("commandTelemetry - 通用命令埋点", () => {
    beforeEach(async () => {
        resetVscodeMock();
        await telemetryService.resetForTests();
        telemetryService.initialize(createFakeExtensionContext(), () => undefined, TEST_CONNECTION_STRING);
    });

    afterEach(async () => {
        await telemetryService.resetForTests();
    });

    it("普通命令成功时记录 command 与 durationMs", async () => {
        registerCommandWithTelemetry("pintia.openPintiaHome", async () => undefined);

        await getRegisteredCommand("pintia.openPintiaHome")!();

        const event = getTelemetryEvents().find((item) => item.name === TELEMETRY_EVENTS.COMMAND);
        assert.ok(event);
        assert.strictEqual(event.properties?.command, "openPintiaHome");
        assert.strictEqual(event.properties?.outcome, "success");
        assert.ok(typeof event.measurements?.durationMs === "number");
    });

    it("专用命令不再产生通用 command 事件", async () => {
        registerCommandWithTelemetry("pintia.searchProblem", async () => undefined);

        await getRegisteredCommand("pintia.searchProblem")!();

        assert.strictEqual(getTelemetryEvents().filter((item) => item.name === TELEMETRY_EVENTS.COMMAND).length, 0);
    });

    it("命令抛错时记录 error 事件并继续抛出", async () => {
        registerCommandWithTelemetry("pintia.openPintiaHome", async () => {
            throw new Error("boom");
        });

        await assert.rejects(() => getRegisteredCommand("pintia.openPintiaHome")!());

        const event = getTelemetryEvents().find((item) => item.name === TELEMETRY_EVENTS.ERROR);
        assert.ok(event);
        assert.strictEqual(event.properties?.command, "openPintiaHome");
        assert.strictEqual(event.properties?.errorName, "Error");
        assert.ok(!JSON.stringify(event).includes("boom"));
    });
});
