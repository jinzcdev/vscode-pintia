import * as vscode from "vscode";
import { telemetryService } from "./telemetryService";
import { TELEMETRY_EVENTS } from "./events";

/**
 * Commands that emit their own dedicated event and therefore must not also
 * produce a generic `pintia/command` event.
 *
 * Only the commands whose specialised events exist are listed here. Submit,
 * test, auth, search-index and timer commands stay on the generic event until
 * their dedicated events land in the next batch.
 */
export const SPECIALIZED_COMMANDS: ReadonlySet<string> = new Set(["pintia.searchProblem", "pintia.previewProblem"]);

export type TelemetryCommandHandler = (...args: any[]) => unknown;

/**
 * Registers a command and records its duration/outcome. Errors are re-thrown so
 * the original command semantics are preserved.
 */
export function registerCommandWithTelemetry(commandId: string, handler: TelemetryCommandHandler): vscode.Disposable {
    if (SPECIALIZED_COMMANDS.has(commandId)) {
        return vscode.commands.registerCommand(commandId, handler);
    }

    return vscode.commands.registerCommand(commandId, async (...args: any[]) => {
        const startedAt = Date.now();
        const command = commandId.replace(/^pintia\./, "");
        try {
            const result = await handler(...args);
            telemetryService.trackEvent(
                TELEMETRY_EVENTS.COMMAND,
                { command, outcome: "success" },
                { durationMs: Date.now() - startedAt }
            );
            return result;
        } catch (error) {
            telemetryService.trackEvent(
                TELEMETRY_EVENTS.COMMAND,
                { command, outcome: "error" },
                { durationMs: Date.now() - startedAt }
            );
            telemetryService.trackError(TELEMETRY_EVENTS.ERROR, error, { command });
            throw error;
        }
    });
}
