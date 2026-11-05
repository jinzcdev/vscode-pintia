import { randomUUID } from "crypto";
import * as vscode from "vscode";
import { TelemetryReporter } from "@vscode/extension-telemetry";
import type { IUserSession } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { TELEMETRY_CONNECTION_STRING, TELEMETRY_DEBUG_ENV, TELEMETRY_INSTALL_ID_KEY } from "./constants";

/** Properties that must never leave the machine, regardless of the call site. */
const FORBIDDEN_PROPERTY_KEYS = new Set([
    "cookie",
    "token",
    "email",
    "password",
    "keyword",
    "query",
    "content",
    "path",
    "filepath",
    "url",
    "title",
    "name",
    "code",
    "program",
    "testinput",
    "testoutput",
    "user",
    "username",
    "nickname",
    "submissionid",
]);

const MAX_PROPERTY_LENGTH = 128;
const MAX_MEASUREMENT = 86_400_000; // one day in ms

export type TelemetryProperties = Record<string, string | number | boolean | undefined>;
export type TelemetryMeasurements = Record<string, number | undefined>;

/**
 * Thin, privacy-conscious wrapper around `@vscode/extension-telemetry`.
 *
 * Responsibilities:
 * - lazy reporter lifecycle and telemetry opt-out checks;
 * - anonymous installation ID + common properties;
 * - property/measurement allow-listing and sanitisation;
 * - guaranteeing that telemetry can never break a user-facing code path.
 */
export class TelemetryService implements vscode.Disposable {
    private context: vscode.ExtensionContext | undefined;
    private getUserSession: () => IUserSession | undefined = () => undefined;
    private reporter: TelemetryReporter | undefined;
    private installId: string | undefined;
    private initialized = false;

    /**
     * @param connectionString Override used by tests; production uses the bundled constant.
     */
    public initialize(
        context: vscode.ExtensionContext,
        getUserSession: () => IUserSession | undefined,
        connectionString: string = TELEMETRY_CONNECTION_STRING
    ): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.context = context;
        this.getUserSession = getUserSession;

        try {
            this.installId = this.loadOrCreateInstallId(context);
            if (!connectionString) {
                return;
            }
            this.reporter = new TelemetryReporter(connectionString);
            // Best effort: some versions of the library fix `user_Id` to the VS Code
            // machine ID. `installId` is always also sent as a regular property.
            this.reporter.setContextTag("ai.user.id", this.installId);
        } catch (error) {
            this.reporter = undefined;
            ptaChannel.warn(`Failed to initialize telemetry: ${error instanceof Error ? error.name : "UnknownError"}`);
        }
    }

    public trackEvent(
        name: string,
        properties: TelemetryProperties = {},
        measurements: TelemetryMeasurements = {}
    ): void {
        try {
            const sanitizedProperties = this.sanitizeProperties(properties);
            const sanitizedMeasurements = this.sanitizeMeasurements(measurements);

            if (process.env[TELEMETRY_DEBUG_ENV] === "1") {
                ptaChannel.info(
                    `[telemetry] ${name} ${JSON.stringify({
                        properties: sanitizedProperties,
                        measurements: sanitizedMeasurements,
                    })}`
                );
            }

            if (!this.canSend()) {
                return;
            }

            this.reporter!.sendTelemetryEvent(name, sanitizedProperties, sanitizedMeasurements);
        } catch {
            // Telemetry must never affect the user's workflow.
        }
    }

    /** Sends an error event without the original message or stack trace. */
    public trackError(name: string, error: unknown, properties: TelemetryProperties = {}): void {
        try {
            this.trackEvent(name, { ...properties, ...toErrorProperties(error) });
        } catch {
            // Never mask the original error.
        }
    }

    public async dispose(): Promise<void> {
        const reporter = this.reporter;
        this.reporter = undefined;
        this.initialized = false;
        if (!reporter) {
            return;
        }
        try {
            await reporter.dispose();
        } catch {
            // Ignore flush failures during shutdown.
        }
    }

    /** Test helper: clears the singleton so a test can initialise it again. */
    public async resetForTests(): Promise<void> {
        await this.dispose();
        this.context = undefined;
        this.getUserSession = () => undefined;
        this.installId = undefined;
    }

    private canSend(): boolean {
        if (!this.reporter || !this.context) {
            return false;
        }
        if (this.context.extensionMode !== vscode.ExtensionMode.Production) {
            return false;
        }
        if (!vscode.env.isTelemetryEnabled) {
            return false;
        }
        return ptaConfig.getTelemetryEnabled();
    }

    private getCommonProperties(): Record<string, string> {
        const session = this.getUserSession();
        const common: Record<string, string> = {
            installId: this.installId ?? "unknown",
            isLoggedIn: session ? "true" : "false",
            extVersion: this.context?.extension?.packageJSON?.version ?? "unknown",
            vscodeVersion: vscode.version ?? "unknown",
            platform: process.platform,
            locale: vscode.env.language ?? "unknown",
        };
        if (session?.loginMethod) {
            common.loginMethod = session.loginMethod;
        }
        return common;
    }

    private loadOrCreateInstallId(context: vscode.ExtensionContext): string {
        let installId = context.globalState?.get<string>(TELEMETRY_INSTALL_ID_KEY);
        if (!installId) {
            installId = randomUUID();
            void context.globalState?.update(TELEMETRY_INSTALL_ID_KEY, installId);
        }
        return installId;
    }

    private sanitizeProperties(properties: TelemetryProperties): Record<string, string> {
        const common = this.getCommonProperties();
        const sanitized: Record<string, string> = { ...common };

        for (const [key, rawValue] of Object.entries(properties)) {
            if (rawValue === undefined || FORBIDDEN_PROPERTY_KEYS.has(key.toLowerCase())) {
                continue;
            }
            const value = String(rawValue)
                .replace(/[\u0000-\u001f\u007f]/g, "")
                .slice(0, MAX_PROPERTY_LENGTH);
            if (value.length > 0) {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private sanitizeMeasurements(measurements: TelemetryMeasurements): Record<string, number> {
        const sanitized: Record<string, number> = {};
        for (const [key, rawValue] of Object.entries(measurements)) {
            if (rawValue === undefined) {
                continue;
            }
            const value = Number(rawValue);
            if (!Number.isFinite(value)) {
                continue;
            }
            sanitized[key] = Math.max(0, Math.min(value, MAX_MEASUREMENT));
        }
        return sanitized;
    }
}

function toErrorProperties(error: unknown): Record<string, string> {
    const name = error instanceof Error ? error.name : typeof error;
    return {
        errorName: /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/.test(name) ? name : "Error",
    };
}

export const telemetryService = new TelemetryService();
