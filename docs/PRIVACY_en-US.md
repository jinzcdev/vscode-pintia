# Data & Privacy

This extension (Pintia for VS Code) uses Azure Application Insights to collect anonymous usage data so we can understand feature usage, diagnose issues and improve the extension. This page explains what is collected, why, and how to opt out.

## What is collected

Every event contains low-cardinality feature/outcome data only; it never includes problem content or account data.

| Category                  | Examples                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous installation ID | A random UUID generated locally on first run (stored in `globalState`); reset when the extension is uninstalled or its state is cleared |
| Sessions                  | Extension activations (used for DAU)                                                                                                    |
| Feature usage             | Command names, invocation counts, durations, success/failure                                                                            |
| Problem search            | Search index size, ZOJ/locked-set filters, selected item rank, open/cancel                                                              |
| Problem preview           | Source (search/explorer/history/favorites/CodeLens/webview/timer stats), load duration, whether a previous submission exists            |
| Preview external links    | Link kind (reference code/search engine/problem/problem set), search engine name; no URLs or keywords                                   |
| Environment               | Extension version, VS Code version, OS, UI language                                                                                     |
| Sign-in state             | Whether signed in, login method (WeChat/Cookie); no account identifiers                                                                 |

## What is not collected

- PTA cookie, username, email, PTA user ID
- Search keywords, problem titles, statements, problem IDs/problem set IDs
- Source code, test input/output, submission IDs
- File paths, URLs, error messages, stack traces

Error events record only the error type name (e.g. `TypeError`); full errors remain in the local output channel.

## About VS Code machine identifiers

`@vscode/extension-telemetry` attaches VS Code's anonymous machine identifier to every event (App Insights `user_Id` / `common.vscodemachineid`). The library writes this field unconditionally and the extension cannot disable it separately. The extra anonymous installation ID we generate is only used to count daily active installations.

## Storage and purpose

- Recipient: Azure Application Insights (Microsoft).
- Purpose: aggregate usage, funnel and reliability statistics. No advertising, profiling or selling.
- Transfer: may involve cross-border transfer.
- Retention: determined by the Application Insights resource (30–90 days recommended).
- App Insights may automatically collect IP/region information; keep IP masking enabled in the Azure resource.

## How to opt out

No telemetry is sent if any of the following is true:

1. VS Code's global `telemetry.telemetryLevel` is `off`;
2. The extension setting `pintia.telemetry.enabled` is `false`.

Telemetry is also disabled in extension development mode (non-production builds).

## Contact

Questions about data collection? Please open a [GitHub Issue](https://github.com/jinzcdev/vscode-pintia/issues).
