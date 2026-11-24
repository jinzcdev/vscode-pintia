import { l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { NO_OFFICIAL_SOLUTION, NONE, ProblemJudgingStatusEnum, problemJudgingStatusMapping, UNKNOWN } from "../shared";
import { defaultIfBlank, escapeHtml } from "../utils/stringUtils";
import { buildSideBySideDiff, DiffCell, DiffRow, outputsIdentical, outputsMatch } from "../utils/textDiff";
import { testSampleSourceLabel } from "../utils/testSamples";
import { PtaWebview } from "./PtaWebview";
import { TestCaseEntry, TestView } from "./views/TestView";

type TestOutcome = "pending" | "running" | "passed" | "failed" | "not-checked" | "error" | "cancelled";

interface ITestCaseView {
    index: number;
    source: string;
    outcome: TestOutcome;
    outcomeLabel: string;
    statusText?: string;
    input: string;
    expected?: string;
    actual: string;
    stderr: string;
    error?: string;
    time?: number;
    memory?: number;
    whitespaceOnly: boolean;
    truncated: boolean;
    diffRows: DiffRow[];
}

interface ITestSummary {
    total: number;
    passed: number;
    failed: number;
    notChecked: number;
    pending: number;
    running: number;
    error: number;
    cancelled: number;
}

function outcomeLabel(outcome: TestOutcome): string {
    switch (outcome) {
        case "pending":
            return l10n.t("Pending");
        case "running":
            return l10n.t("Running");
        case "passed":
            return l10n.t("Passed");
        case "failed":
            return l10n.t("Failed");
        case "not-checked":
            return l10n.t("Not checked");
        case "error":
            return l10n.t("Error");
        case "cancelled":
            return l10n.t("Cancelled");
        default:
            return "";
    }
}

function formatTime(time: number | undefined): string {
    return time === undefined ? "" : `${(time * 1000).toFixed()}ms`;
}

function formatMemory(memory: number | undefined): string {
    return memory === undefined ? "" : `${(memory / 1024).toFixed(0)}KB`;
}

function evaluateOutcome(entry: TestCaseEntry, actual: string, truncated: boolean, status: string): TestOutcome {
    const expected = entry.sample.expected;
    const executionFailed = status !== "" && status !== ProblemJudgingStatusEnum.NEUTRAL && status !== "ACCEPTED";

    if (executionFailed) {
        return "failed";
    }
    if (expected === undefined) {
        return status === "ACCEPTED" ? "passed" : "not-checked";
    }
    if (truncated) {
        return "not-checked";
    }
    return outputsMatch(expected, actual) ? "passed" : "failed";
}

export class PtaTestProvider extends PtaWebview<TestView> {
    private static instance: PtaTestProvider | null = null;

    public static createOrUpdate(view: TestView): PtaTestProvider {
        if (!PtaTestProvider.instance) {
            PtaTestProvider.instance = new PtaTestProvider(view);
        }
        PtaTestProvider.instance.updateView(view);
        return PtaTestProvider.instance;
    }

    protected async loadViewData(testView: TestView): Promise<void> {
        const cases: ITestCaseView[] = [];
        let compilerOutput = "";

        for (let index = 0; index < testView.cases.length; index++) {
            const entry = testView.cases[index];
            const view = this.buildCaseView(index, entry);
            cases.push(view);

            const log = entry.result?.submission?.judgeResponseContents?.[0];
            const codeJudge = log?.programmingJudgeResponseContent ?? log?.codeCompletionJudgeResponseContent;
            if (!compilerOutput) {
                compilerOutput = codeJudge?.compilationResult?.log ?? "";
            }
        }

        const summary: ITestSummary = {
            total: cases.length,
            passed: 0,
            failed: 0,
            notChecked: 0,
            pending: 0,
            running: 0,
            error: 0,
            cancelled: 0,
        };
        for (const item of cases) {
            switch (item.outcome) {
                case "passed":
                    summary.passed++;
                    break;
                case "failed":
                    summary.failed++;
                    break;
                case "not-checked":
                    summary.notChecked++;
                    break;
                case "pending":
                    summary.pending++;
                    break;
                case "running":
                    summary.running++;
                    break;
                case "error":
                    summary.error++;
                    break;
                case "cancelled":
                    summary.cancelled++;
                    break;
            }
        }

        this.data = {
            title: `${l10n.t("Test Result")} | ${testView.problem?.title ?? UNKNOWN}`,
            summary,
            cases,
            compilerOutput: defaultIfBlank(compilerOutput, NONE),
        };
    }

    private buildCaseView(index: number, entry: TestCaseEntry): ITestCaseView {
        const source = testSampleSourceLabel(entry.sample.source);
        const fallback: ITestCaseView = {
            index,
            source,
            outcome: entry.phase === "done" ? "not-checked" : entry.phase,
            outcomeLabel: "",
            input: entry.sample.input,
            expected: entry.sample.expected,
            actual: "",
            stderr: "",
            error: entry.error,
            whitespaceOnly: false,
            truncated: false,
            diffRows: [],
        };

        if (entry.phase !== "done" || !entry.result) {
            fallback.outcomeLabel = outcomeLabel(fallback.outcome);
            return fallback;
        }

        try {
            const judgeResponse = entry.result.submission?.judgeResponseContents?.[0];
            const codeJudge =
                judgeResponse?.programmingJudgeResponseContent ?? judgeResponse?.codeCompletionJudgeResponseContent;
            const custom = codeJudge?.testcaseJudgeResults?.["custom"];
            const status = judgeResponse?.status ?? "";
            const actual = custom?.stdout ?? "";
            const truncated = custom?.stdoutTruncated === true;
            const outcome = evaluateOutcome(entry, actual, truncated, status);
            const expected = entry.sample.expected;

            return {
                index,
                source,
                outcome,
                outcomeLabel: outcomeLabel(outcome),
                statusText:
                    status && status !== ProblemJudgingStatusEnum.NEUTRAL
                        ? (problemJudgingStatusMapping.get(status)?.text ?? status)
                        : undefined,
                input: entry.result.submission?.submissionDetails?.[0]?.customTestData?.content ?? entry.sample.input,
                expected,
                actual,
                stderr: custom?.stderr ?? "",
                error: entry.error,
                time: custom?.time ?? entry.result.submission?.time,
                memory: custom?.memory ?? entry.result.submission?.memory,
                whitespaceOnly: outcome === "passed" && expected !== undefined && !outputsIdentical(expected, actual),
                truncated,
                diffRows:
                    outcome === "failed" && expected !== undefined && !truncated
                        ? buildSideBySideDiff(expected, actual)
                        : [],
            };
        } catch (error: any) {
            ptaChannel.error(error?.toString?.() ?? String(error));
            return {
                ...fallback,
                outcome: "error",
                outcomeLabel: outcomeLabel("error"),
                error: error?.message ?? String(error),
            };
        }
    }

    protected getStyle(): string {
        return `
            <style>
                :root {
                    --border-color: var(--vscode-editorWidget-border);
                    --primary-font: var(--vscode-font-family);
                    --secondary-font: var(--vscode-editor-font-family);
                    --background-color: var(--vscode-editor-background);
                    --foreground-color: var(--vscode-editor-foreground);
                    --border-radius: 8px;
                    --box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    --secondary-color: var(--vscode-descriptionForeground);
                    --table-header-bg: var(--vscode-editorGroupHeader-tabsBackground);
                    --table-header-color: var(--vscode-editor-foreground);
                    --passed-color: var(--vscode-testing-iconPassed, #3fb950);
                    --failed-color: var(--vscode-testing-iconFailed, #f85149);
                    --removed-bg: var(--vscode-diffEditor-removedLineBackground, rgba(248, 81, 73, 0.18));
                    --added-bg: var(--vscode-diffEditor-insertedLineBackground, rgba(63, 185, 80, 0.18));
                }

                .test-container {
                    padding: 1rem;
                    background-color: var(--background-color);
                    border-radius: var(--border-radius);
                    box-shadow: var(--box-shadow);
                    margin: 0.2rem auto;
                    max-width: 90vh;
                }

                html,
                body {
                    height: 100%;
                    margin: 0;
                    line-height: 1.5;
                    font-family: var(--primary-font);
                    color: var(--foreground-color);
                    background-color: var(--background-color);
                }

                h2 {
                    font-size: 1.4rem;
                    margin: 1.5rem 0 1rem;
                    text-align: left;
                    padding-bottom: 0.5rem;
                }

                h3 {
                    font-size: 1rem;
                    margin: 1rem 0 0.5rem;
                }

                table {
                    width: 100%;
                    margin: 16px 0;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.875rem;
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    overflow: hidden;
                }

                thead {
                    background-color: var(--table-header-bg);
                    color: var(--table-header-color);
                }

                th,
                td {
                    padding: 0.6rem 0.8rem;
                    border: 1px solid var(--border-color);
                    word-wrap: break-word;
                    white-space: normal;
                }

                th {
                    background-color: var(--table-header-bg);
                    color: var(--table-header-color);
                    font-weight: bold;
                }

                pre,
                code {
                    margin: 0;
                    padding: 0;
                }

                code {
                    color: var(--foreground-color);
                    display: block;
                    background-color: transparent;
                    font-family: var(--secondary-font);
                }

                .test-container code {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .summary-line {
                    color: var(--secondary-color);
                    font-size: 0.9rem;
                    margin: 0.5rem 0 1rem;
                }

                .badge {
                    display: inline-block;
                    padding: 1px 8px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    border: 1px solid currentColor;
                    white-space: nowrap;
                }

                .badge.passed {
                    color: var(--passed-color);
                }

                .badge.failed {
                    color: var(--failed-color);
                }

                .badge.pending,
                .badge.running,
                .badge.not-checked,
                .badge.cancelled,
                .badge.error {
                    color: var(--secondary-color);
                }

                .case-card {
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 1rem;
                    margin: 1rem 0;
                    background-color: var(--vscode-editorWidget-background);
                }

                .case-header {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    flex-wrap: wrap;
                }

                .case-title {
                    font-weight: 600;
                }

                .case-meta {
                    color: var(--secondary-color);
                    font-size: 0.8rem;
                }

                .case-source {
                    color: var(--secondary-color);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    padding: 0 6px;
                    font-size: 0.75rem;
                }

                .input-block pre,
                .output-block pre {
                    background-color: var(--vscode-textCodeBlock-background, transparent);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 0.75rem;
                    overflow-x: auto;
                    max-height: 40vh;
                }

                .diff {
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    overflow-x: auto;
                    font-size: 0.85rem;
                }

                .diff-header,
                .diff-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    min-width: 100%;
                }

                .diff-header {
                    background-color: var(--table-header-bg);
                    font-weight: 600;
                }

                .diff-header span {
                    padding: 0.4rem 0.75rem;
                    border-bottom: 1px solid var(--border-color);
                }

                .diff-header span:first-child {
                    border-right: 1px solid var(--border-color);
                }

                .diff-cell {
                    display: flex;
                    gap: 0.5rem;
                    padding: 0 0.5rem;
                    white-space: pre;
                    overflow-x: auto;
                    min-width: 0;
                    font-family: var(--secondary-font);
                }

                .diff-cell:first-child {
                    border-right: 1px solid var(--border-color);
                }

                .diff-cell.removed {
                    background-color: var(--removed-bg);
                }

                .diff-cell.added {
                    background-color: var(--added-bg);
                }

                .diff-cell.whitespace {
                    outline: 1px dashed var(--vscode-editorWarning-foreground, #cca700);
                    outline-offset: -1px;
                }

                .diff-cell.empty {
                    background-color: transparent;
                }

                .diff .ln {
                    flex: 0 0 3ch;
                    text-align: right;
                    color: var(--secondary-color);
                    user-select: none;
                }

                .diff code {
                    white-space: pre;
                    display: inline;
                    font-family: var(--secondary-font);
                }

                .diff-cell.empty code {
                    display: none;
                }

                .note {
                    color: var(--secondary-color);
                    font-size: 0.85rem;
                    margin: 0.5rem 0;
                }

                .note.warning {
                    color: var(--vscode-editorWarning-foreground, #cca700);
                }

                .error-box {
                    border-left: 3px solid var(--vscode-errorForeground, #f85149);
                    background-color: var(--vscode-inputValidation-errorBackground, transparent);
                    padding: 0.75rem;
                    margin: 0.75rem 0;
                    white-space: pre-wrap;
                    font-family: var(--secondary-font);
                    font-size: 0.85rem;
                }

                details summary {
                    cursor: pointer;
                    color: var(--secondary-color);
                    margin-top: 0.5rem;
                }

                .code-preview {
                    width: 100%;
                    border: 1px solid var(--border-color);
                    margin-top: 20px;
                    padding: 1rem;
                    overflow: auto;
                    font-size: 0.875rem;
                    max-height: 50vh;
                    background-color: var(--vscode-editorWidget-background);
                    border-radius: var(--border-radius);
                    box-sizing: border-box;
                }
            </style>`;
    }

    protected getContent(): string {
        const data = this.data;
        const summary: ITestSummary = data.summary;
        const summaryParts = [
            l10n.t("{0} passed", summary.passed),
            l10n.t("{0} failed", summary.failed),
            l10n.t("{0} not checked", summary.notChecked),
        ];
        if (summary.running > 0 || summary.pending > 0) {
            summaryParts.push(l10n.t("{0} running", summary.running + summary.pending));
        }
        if (summary.cancelled > 0) {
            summaryParts.push(l10n.t("{0} cancelled", summary.cancelled));
        }
        if (summary.error > 0) {
            summaryParts.push(l10n.t("{0} errors", summary.error));
        }

        const rows = (data.cases as ITestCaseView[])
            .map(
                (item) => `
                    <tr>
                        <td>#${item.index + 1}</td>
                        <td>${escapeHtml(item.source)}</td>
                        <td><span class="badge ${item.outcome}">${escapeHtml(item.outcomeLabel)}</span></td>
                        <td>${formatTime(item.time)}</td>
                        <td>${formatMemory(item.memory)}</td>
                    </tr>`
            )
            .join("");

        return `
            <div class="test-container">
                <h2>${l10n.t("Test Result")}</h2>
                <p class="summary-line">${escapeHtml(summaryParts.join(" · "))}</p>

                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>${l10n.t("Source")}</th>
                            <th>${l10n.t("Result")}</th>
                            <th>${l10n.t("Time")}</th>
                            <th>${l10n.t("Memory")}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>

                ${(data.cases as ITestCaseView[]).map((item) => this.renderCase(item)).join("")}

                <h2>${l10n.t("Compiler Output")}</h2>
                <div class="code-preview">
                    <pre><code>${escapeHtml(data.compilerOutput)}</code></pre>
                </div>
            </div>
        `;
    }

    private renderCase(item: ITestCaseView): string {
        const meta = [item.source, item.statusText, formatTime(item.time), formatMemory(item.memory)]
            .filter((part) => !!part)
            .join(" · ");

        return `
            <section class="case-card">
                <header class="case-header">
                    <span class="case-title">#${item.index + 1}</span>
                    <span class="case-source">${escapeHtml(item.source)}</span>
                    <span class="badge ${item.outcome}">${escapeHtml(item.outcomeLabel)}</span>
                    <span class="case-meta">${escapeHtml(meta)}</span>
                </header>

                <h3>${l10n.t("Input")}</h3>
                <div class="input-block">
                    <pre><code>${escapeHtml(item.input)}</code></pre>
                </div>

                ${this.renderCaseBody(item)}
            </section>
        `;
    }

    private renderCaseBody(item: ITestCaseView): string {
        if (item.outcome === "pending") {
            return `<p class="note">${l10n.t("Pending")}</p>`;
        }
        if (item.outcome === "running") {
            return `<p class="note">${l10n.t("Running")}</p>`;
        }
        if (item.outcome === "cancelled") {
            return `<p class="note">${l10n.t("Test run cancelled.")}</p>`;
        }
        if (item.outcome === "error") {
            return `
                <div class="error-box">${escapeHtml(item.error ?? "")}</div>
                ${this.renderStderr(item.stderr)}
            `;
        }

        const expectedBlock =
            item.expected === undefined ? `<p class="note">${escapeHtml(NO_OFFICIAL_SOLUTION)}</p>` : "";

        if (item.outcome === "failed" && item.diffRows.length > 0) {
            return `
                <h3>${l10n.t("Expected Output")} / ${l10n.t("Actual Output")}</h3>
                ${this.renderDiff(item.diffRows)}
                ${item.truncated ? `<p class="note warning">${l10n.t("This output was truncated by the server.")}</p>` : ""}
                ${this.renderStderr(item.stderr)}
            `;
        }

        if (item.outcome === "failed") {
            return `
                ${item.expected === undefined ? expectedBlock : this.renderOutput(l10n.t("Expected Output"), item.expected)}
                ${this.renderOutput(l10n.t("Actual Output"), item.actual)}
                ${item.truncated ? `<p class="note warning">${l10n.t("This output was truncated by the server.")}</p>` : ""}
                ${this.renderStderr(item.stderr)}
            `;
        }

        if (item.outcome === "not-checked") {
            return `
                ${
                    item.expected === undefined
                        ? expectedBlock
                        : this.renderOutput(l10n.t("Expected Output"), item.expected)
                }
                ${this.renderOutput(l10n.t("Actual Output"), item.actual)}
                ${item.truncated ? `<p class="note warning">${l10n.t("This output was truncated by the server.")}</p>` : ""}
                ${
                    item.expected === undefined
                        ? `<p class="note">${l10n.t("No expected output for this sample; unable to determine whether it passed.")}</p>`
                        : ""
                }
                ${this.renderStderr(item.stderr)}
            `;
        }

        return `
            ${this.renderOutput(l10n.t("Actual Output"), item.actual)}
            ${item.whitespaceOnly ? `<p class="note">${l10n.t("Passed (trailing whitespace ignored)")}</p>` : ""}
            ${this.renderStderr(item.stderr)}
        `;
    }

    private renderOutput(title: string, content: string): string {
        return `
            <h3>${escapeHtml(title)}</h3>
            <div class="output-block">
                <pre><code>${escapeHtml(content)}</code></pre>
            </div>
        `;
    }

    private renderStderr(stderr: string): string {
        if (!stderr.trim()) {
            return "";
        }
        return `
            <details>
                <summary>stderr</summary>
                <div class="output-block">
                    <pre><code>${escapeHtml(stderr)}</code></pre>
                </div>
            </details>
        `;
    }

    private renderDiff(rows: DiffRow[]): string {
        const body = rows
            .map(
                (row) => `
                    <div class="diff-row">
                        ${this.renderDiffCell(row.left, row.whitespaceOnly)}
                        ${this.renderDiffCell(row.right, row.whitespaceOnly)}
                    </div>`
            )
            .join("");

        return `
            <div class="diff">
                <div class="diff-header">
                    <span>${l10n.t("Expected Output")}</span>
                    <span>${l10n.t("Actual Output")}</span>
                </div>
                ${body}
            </div>
        `;
    }

    private renderDiffCell(cell: DiffCell | undefined, whitespaceOnly: boolean | undefined): string {
        if (!cell) {
            return `<div class="diff-cell empty"></div>`;
        }
        const classes = ["diff-cell", cell.kind];
        if (whitespaceOnly) {
            classes.push("whitespace");
        }
        const text = cell.text.length > 0 ? escapeHtml(cell.text) : "&#8203;";
        return `
            <div class="${classes.join(" ")}">
                <span class="ln">${cell.lineNo}</span>
                <code>${text}</code>
            </div>
        `;
    }
}
