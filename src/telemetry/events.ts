/**
 * Event names and enums shared by the extension-side telemetry call sites.
 *
 * Keep property values low-cardinality. Never add problem content, search
 * keywords, cookies, account data, source code or file paths here.
 */
export const TELEMETRY_EVENTS = {
    SESSION_START: "pintia/session.start",
    COMMAND: "pintia/command",
    ERROR: "pintia/error",
    SEARCH_OPEN: "pintia/search.open",
    SEARCH_SELECT: "pintia/search.select",
    SEARCH_CANCEL: "pintia/search.cancel",
    PREVIEW_OPEN: "pintia/preview.open",
    PREVIEW_ACTION: "pintia/preview.action",
} as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS];

/** Where a preview was opened from. Used to build the search → preview funnel. */
export type PreviewSource =
    | "unknown"
    | "search"
    | "explorer"
    | "history"
    | "favorites"
    | "codelens"
    | "webview"
    | "timerStats";

export const PREVIEW_LINK_KINDS = ["referenceCode", "search", "problemTitle", "problemSet"] as const;
export type PreviewLinkKind = (typeof PREVIEW_LINK_KINDS)[number];

export const PREVIEW_SEARCH_ENGINES = ["google", "bing", "baidu"] as const;
export type PreviewSearchEngine = (typeof PREVIEW_SEARCH_ENGINES)[number];

export function isPreviewLinkKind(value: unknown): value is PreviewLinkKind {
    return typeof value === "string" && (PREVIEW_LINK_KINDS as readonly string[]).includes(value);
}

export function isPreviewSearchEngine(value: unknown): value is PreviewSearchEngine {
    return typeof value === "string" && (PREVIEW_SEARCH_ENGINES as readonly string[]).includes(value);
}
