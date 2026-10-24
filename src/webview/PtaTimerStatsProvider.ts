import * as vscode from "vscode";
import { l10n } from "vscode";
import { getGlobalContext } from "../globalContext";
import { ITimerAttempt } from "../shared";
import { formatDuration } from "../utils/durationUtils";
import { escapeHtml } from "../utils/stringUtils";
import { IWebViewMessage, PtaWebview } from "./PtaWebview";

type TrendDirection = "improving" | "worsening" | "flat";

interface IProblemTrend {
    psID: string;
    pID: string;
    psName: string;
    title: string;
    /** 按 AC 时间正序（旧 → 新），用于绘制趋势 */
    attempts: ITimerAttempt[];
    latest: ITimerAttempt;
    best: ITimerAttempt;
    averageSeconds: number;
    count: number;
    /** 相对首次 AC 的变化百分比；正数表示更快。仅 1 次时为 null */
    improvement: number | null;
    trend: TrendDirection;
}

interface IProblemSetGroup {
    psName: string;
    trends: IProblemTrend[];
    problemCount: number;
    totalAttempts: number;
    /** 该题集最近一次 AC 时间，用于题集排序 */
    latestAcceptedAt: string;
}

interface ITimerStatsData {
    title: string;
    problemSets: IProblemSetGroup[];
    problemCount: number;
    totalAttempts: number;
    averageSeconds: number;
    fastestSeconds: number;
}

function problemKey(attempt: ITimerAttempt): string {
    return `${attempt.psID}|${attempt.pID}`;
}

function formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
}

function formatShortDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

/**
 * 答题耗时统计页。
 *
 * 以题目为单位展示：每道题一行，带最近一次用时和趋势缩略图；
 * 点击右侧展开该题的全部 AC 趋势图与记录，点击题目名打开题目预览。
 *
 * 图表用内联 SVG（CSP 允许 nonce 脚本），不引入图表库。
 */
export class PtaTimerStatsProvider extends PtaWebview<ITimerAttempt[]> {
    private static instance: PtaTimerStatsProvider | null = null;

    public static createOrUpdate(attempts: ITimerAttempt[]): PtaTimerStatsProvider {
        if (!PtaTimerStatsProvider.instance) {
            PtaTimerStatsProvider.instance = new PtaTimerStatsProvider(attempts);
        }
        PtaTimerStatsProvider.instance.updateView(attempts);
        return PtaTimerStatsProvider.instance;
    }

    protected async loadViewData(attempts: ITimerAttempt[]): Promise<void> {
        // manager 已按时间倒序返回；这里再排一次，保证单测直接传数组时也正确
        const sorted = [...attempts].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));

        const groupMap = new Map<string, ITimerAttempt[]>();
        for (const attempt of sorted) {
            const key = problemKey(attempt);
            const group = groupMap.get(key);
            if (group) {
                group.push(attempt);
            } else {
                groupMap.set(key, [attempt]);
            }
        }

        const trends: IProblemTrend[] = [];
        for (const group of groupMap.values()) {
            // 组内改为正序，趋势图从旧到新
            const chronological = [...group].sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt));
            const latest = chronological[chronological.length - 1];
            const first = chronological[0];
            const best = chronological.reduce((min, item) => (item.seconds < min.seconds ? item : min), first);
            const totalSeconds = chronological.reduce((sum, item) => sum + item.seconds, 0);
            const improvement =
                chronological.length > 1 && first.seconds > 0
                    ? Math.round(((first.seconds - latest.seconds) / first.seconds) * 100)
                    : null;
            const trend: TrendDirection =
                improvement === null || improvement === 0 ? "flat" : improvement > 0 ? "improving" : "worsening";

            trends.push({
                psID: latest.psID,
                pID: latest.pID,
                psName: latest.psName,
                title: latest.title,
                attempts: chronological,
                latest,
                best,
                averageSeconds: Math.round(totalSeconds / chronological.length),
                count: chronological.length,
                improvement,
                trend,
            });
        }
        // 先按题集分组，再在题集内按最近一次用时从慢到快排列
        const setMap = new Map<string, IProblemTrend[]>();
        for (const trend of trends) {
            const key = trend.psName || "";
            const group = setMap.get(key);
            if (group) {
                group.push(trend);
            } else {
                setMap.set(key, [trend]);
            }
        }

        const problemSets: IProblemSetGroup[] = [...setMap.entries()].map(([psName, items]) => {
            const sortedTrends = [...items].sort((a, b) => b.latest.seconds - a.latest.seconds);
            return {
                psName,
                trends: sortedTrends,
                problemCount: sortedTrends.length,
                totalAttempts: sortedTrends.reduce((sum, item) => sum + item.count, 0),
                latestAcceptedAt: sortedTrends.reduce(
                    (latest, item) => (item.latest.acceptedAt > latest ? item.latest.acceptedAt : latest),
                    ""
                ),
            };
        });
        // 最近练过的题集排在前面
        problemSets.sort((a, b) => b.latestAcceptedAt.localeCompare(a.latestAcceptedAt));

        const totalSeconds = sorted.reduce((sum, attempt) => sum + attempt.seconds, 0);

        this.data = {
            title: l10n.t("Answer Time Statistics"),
            problemSets,
            problemCount: trends.length,
            totalAttempts: sorted.length,
            averageSeconds: sorted.length ? Math.round(totalSeconds / sorted.length) : 0,
            fastestSeconds: sorted.length ? Math.min(...sorted.map((attempt) => attempt.seconds)) : 0,
        } as ITimerStatsData;
    }

    protected async onDidReceiveMessage(msg: IWebViewMessage): Promise<void> {
        if (msg.type === "command" && msg.value === "pintia.previewProblem") {
            const [psID, pID] = (msg.args ?? []) as string[];
            if (psID && pID) {
                await vscode.commands.executeCommand("pintia.previewProblem", psID, pID, false);
            }
        }
    }

    protected getStyle(): string {
        return `
            <style>
                :root {
                    --border-color: var(--vscode-editorWidget-border);
                    --background-color: var(--vscode-editor-background);
                    --foreground-color: var(--vscode-editor-foreground);
                    --card-background: var(--vscode-editorWidget-background);
                    --muted-color: var(--vscode-descriptionForeground);
                    --hover-background: var(--vscode-toolbar-hoverBackground);
                    --link-color: var(--vscode-textLink-foreground);
                    --link-hover-color: var(--vscode-textLink-activeForeground);
                    --green: var(--vscode-charts-green);
                    --orange: var(--vscode-charts-orange, var(--vscode-charts-red));
                    --blue: var(--vscode-charts-blue);
                    --border-radius: 8px;
                }

                html,
                body {
                    margin: 0;
                    padding: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--foreground-color);
                    background-color: var(--background-color);
                    line-height: 1.5;
                }

                button {
                    font-family: inherit;
                }

                .stats-container {
                    max-width: 960px;
                    margin: 0 auto;
                    padding: 24px;
                }

                h1 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    margin: 0 0 20px;
                }

                h2 {
                    font-size: 1.15rem;
                    font-weight: 600;
                    margin: 0;
                }

                .summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 12px;
                }

                .stat-card {
                    background: var(--card-background);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 14px 16px;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 600;
                }

                .stat-label {
                    color: var(--muted-color);
                    font-size: 0.85rem;
                    margin-top: 2px;
                }

                .section-header {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 16px;
                    flex-wrap: wrap;
                    margin: 28px 0 12px;
                }

                .hint {
                    color: var(--muted-color);
                    font-size: 0.82rem;
                    margin: 0;
                }

                .problem-set-block {
                    margin-bottom: 24px;
                }

                .problem-set-block:last-child {
                    margin-bottom: 0;
                }

                .set-header {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    flex-wrap: wrap;
                    padding-bottom: 6px;
                    margin-bottom: 10px;
                    border-bottom: 1px solid var(--border-color);
                }

                .set-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .set-meta {
                    color: var(--muted-color);
                    font-size: 0.8rem;
                }

                .problem-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .problem-card {
                    background: var(--card-background);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    overflow: hidden;
                }

                .problem-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    flex-wrap: wrap;
                }

                .problem-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: none;
                    border: none;
                    padding: 0;
                    color: var(--link-color);
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: left;
                    min-width: 0;
                }

                .problem-link:hover {
                    color: var(--link-hover-color);
                    text-decoration: underline;
                }

                .problem-title {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .external-icon {
                    font-size: 0.8em;
                    opacity: 0.75;
                }

                .expand-toggle {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 10px;
                    min-width: 0;
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 0.85rem;
                    padding: 4px 6px;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .expand-toggle:hover {
                    background: var(--hover-background);
                }

                .attempt-count {
                    color: var(--muted-color);
                    font-size: 0.8rem;
                    white-space: nowrap;
                }

                .sparkline {
                    display: inline-flex;
                    width: 96px;
                    height: 28px;
                    flex: none;
                }

                .sparkline svg {
                    width: 100%;
                    height: 100%;
                }

                .sparkline.improving,
                .trend-chart.improving {
                    color: var(--green);
                }

                .sparkline.worsening,
                .trend-chart.worsening {
                    color: var(--orange);
                }

                .sparkline.flat,
                .trend-chart.flat {
                    color: var(--blue);
                }

                .latest {
                    font-variant-numeric: tabular-nums;
                    font-size: 0.9rem;
                    min-width: 52px;
                    text-align: right;
                    white-space: nowrap;
                }

                .chevron {
                    color: var(--muted-color);
                    transition: transform 0.15s ease;
                    white-space: nowrap;
                }

                .problem-card.expanded .chevron {
                    transform: rotate(90deg);
                }

                .problem-detail {
                    border-top: 1px solid var(--border-color);
                    padding: 14px 16px 16px;
                }

                .detail-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .detail-stats {
                    display: flex;
                    gap: 20px;
                    flex-wrap: wrap;
                }

                .detail-stat {
                    display: flex;
                    flex-direction: column;
                }

                .detail-stat-value {
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                }

                .detail-stat-label {
                    color: var(--muted-color);
                    font-size: 0.78rem;
                }

                .open-button {
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .improvement {
                    display: inline-block;
                    margin: 12px 0 0;
                    font-size: 0.85rem;
                }

                .improvement.improving {
                    color: var(--green);
                }

                .improvement.worsening {
                    color: var(--orange);
                }

                .improvement.flat {
                    color: var(--muted-color);
                }

                .trend-chart {
                    width: 100%;
                    height: auto;
                    margin-top: 6px;
                }

                .chart-grid {
                    stroke: var(--border-color);
                    stroke-width: 1;
                    stroke-dasharray: 3 3;
                }

                .chart-label {
                    fill: var(--muted-color);
                    font-size: 11px;
                }

                .chart-line {
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 2;
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }

                .chart-dot {
                    fill: currentColor;
                }

                .trend-empty {
                    color: var(--muted-color);
                    font-size: 0.85rem;
                    margin-top: 8px;
                }

                .attempt-list-header {
                    color: var(--muted-color);
                    font-size: 0.8rem;
                    margin-top: 14px;
                }

                .attempt-list {
                    list-style: none;
                    margin: 6px 0 0;
                    padding: 0;
                }

                .attempt-list li {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 6px 0;
                    border-bottom: 1px solid var(--border-color);
                    font-size: 0.85rem;
                }

                .attempt-list li:last-child {
                    border-bottom: none;
                }

                .attempt-date {
                    color: var(--muted-color);
                    flex: 1;
                }

                .attempt-time {
                    font-variant-numeric: tabular-nums;
                }

                .attempt-delta {
                    min-width: 58px;
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }

                .attempt-delta.faster {
                    color: var(--green);
                }

                .attempt-delta.slower {
                    color: var(--orange);
                }

                .empty {
                    margin-top: 40px;
                    text-align: center;
                    color: var(--muted-color);
                }

                .empty h2 {
                    color: var(--foreground-color);
                    margin-bottom: 8px;
                }
            </style>`;
    }

    protected getContent(): string {
        const data = this.data as ITimerStatsData;

        if (data.totalAttempts === 0) {
            return `
                <div class="stats-container">
                    <h1>${l10n.t("Answer Time Statistics")}</h1>
                    <div class="empty">
                        <h2>${l10n.t("No accepted attempts yet.")}</h2>
                        <p>${l10n.t(
                            "Start timing before solving a problem; the time is recorded when a submission is accepted."
                        )}</p>
                    </div>
                </div>`;
        }

        const scriptUri = this.getWebview()?.asWebviewUri(
            vscode.Uri.joinPath(getGlobalContext().extensionUri, "media", "timerStats.js")
        );

        return `
            <div class="stats-container">
                <h1>${l10n.t("Answer Time Statistics")}</h1>

                <div class="summary">
                    ${this.renderStatCard(data.problemCount, l10n.t("Accepted Problems"))}
                    ${this.renderStatCard(data.totalAttempts, l10n.t("Total Accepted Submissions"))}
                    ${this.renderStatCard(formatDuration(data.averageSeconds), l10n.t("Average Time"))}
                    ${this.renderStatCard(formatDuration(data.fastestSeconds), l10n.t("Fastest Time"))}
                </div>

                <div class="section-header">
                    <h2>${l10n.t("Time by Problem Set")}</h2>
                    <p class="hint">${l10n.t("Click a problem name to open it; click the row to see its trend.")}</p>
                </div>

                ${data.problemSets.map((set, index) => this.renderProblemSet(set, index)).join("")}
            </div>
            <script nonce="${this.nonce}" src="${scriptUri}"></script>`;
    }

    private renderStatCard(value: number | string, label: string): string {
        return `
            <div class="stat-card">
                <div class="stat-value">${value}</div>
                <div class="stat-label">${escapeHtml(label)}</div>
            </div>`;
    }

    private renderProblemSet(set: IProblemSetGroup, setIndex: number): string {
        const name = set.psName || l10n.t("Unknown problem set");
        return `
            <section class="problem-set-block">
                <div class="set-header">
                    <h3>${escapeHtml(name)}</h3>
                    <span class="set-meta">${l10n.t(
                        "{0} problems · {1} AC records",
                        set.problemCount,
                        set.totalAttempts
                    )}</span>
                </div>
                <div class="problem-list">
                    ${set.trends.map((trend, index) => this.renderProblemCard(trend, `${setIndex}-${index}`)).join("")}
                </div>
            </section>`;
    }

    private renderProblemCard(trend: IProblemTrend, index: string): string {
        const title = trend.title || trend.pID;
        const detailId = `problem-detail-${index}`;
        return `
            <div class="problem-card" data-key="${escapeHtml(problemKey(trend.latest))}">
                <div class="problem-header">
                    ${this.renderOpenButton(trend, title)}
                    <button class="expand-toggle" aria-expanded="false" aria-controls="${detailId}">
                        <span class="attempt-count">×${trend.count}</span>
                        <span class="sparkline ${trend.trend}">${this.renderSparkline(trend.attempts)}</span>
                        <span class="latest">${formatDuration(trend.latest.seconds)}</span>
                        <span class="chevron" aria-hidden="true">▸</span>
                    </button>
                </div>
                <div class="problem-detail" id="${detailId}" hidden>
                    <div class="detail-top">
                        <div class="detail-stats">
                            ${this.renderDetailStat(l10n.t("Latest"), formatDuration(trend.latest.seconds))}
                            ${this.renderDetailStat(l10n.t("Best"), formatDuration(trend.best.seconds))}
                            ${this.renderDetailStat(l10n.t("Average"), formatDuration(trend.averageSeconds))}
                            ${this.renderDetailStat(l10n.t("Attempts"), String(trend.count))}
                        </div>
                        ${this.renderOpenButton(trend, l10n.t("Open Problem"), "open-button")}
                    </div>
                    ${this.renderImprovement(trend)}
                    ${this.renderTrendChart(trend)}
                    ${this.renderAttemptList(trend.attempts)}
                </div>
            </div>`;
    }

    private renderOpenButton(trend: IProblemTrend, label: string, className: string = ""): string {
        return `<button class="problem-link ${className}" data-psid="${escapeHtml(
            trend.psID
        )}" data-pid="${escapeHtml(trend.pID)}" title="${escapeHtml(l10n.t("Open Problem"))}">
            <span class="problem-title">${escapeHtml(label)}</span><span class="external-icon" aria-hidden="true">↗</span>
        </button>`;
    }

    private renderDetailStat(label: string, value: string): string {
        return `
            <div class="detail-stat">
                <span class="detail-stat-value">${value}</span>
                <span class="detail-stat-label">${escapeHtml(label)}</span>
            </div>`;
    }

    private renderImprovement(trend: IProblemTrend): string {
        if (trend.improvement === null) {
            // 单次 AC 的「暂无趋势」由下方图表区域统一显示，避免重复两次
            return "";
        }
        if (trend.improvement > 0) {
            return `<div class="improvement improving">${l10n.t(
                "Faster than the first attempt by {0}%",
                trend.improvement
            )}</div>`;
        }
        if (trend.improvement < 0) {
            return `<div class="improvement worsening">${l10n.t(
                "Slower than the first attempt by {0}%",
                Math.abs(trend.improvement)
            )}</div>`;
        }
        return `<div class="improvement flat">${l10n.t("Same as the first attempt")}</div>`;
    }

    /** 列表行里的迷你趋势线：只看形状，不画坐标轴 */
    private renderSparkline(attempts: ITimerAttempt[]): string {
        const width = 96;
        const height = 28;
        const pad = 3;
        if (attempts.length === 1) {
            return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
                <circle cx="${width / 2}" cy="${height / 2}" r="2.5" fill="currentColor"></circle>
            </svg>`;
        }

        const values = attempts.map((attempt) => attempt.seconds);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = Math.max(max - min, 1);
        const xFor = (index: number): number => pad + (index / (attempts.length - 1)) * (width - pad * 2);
        const yFor = (value: number): number => pad + (1 - (value - min) / span) * (height - pad * 2);
        const points = attempts
            .map((attempt, index) => `${xFor(index).toFixed(1)},${yFor(attempt.seconds).toFixed(1)}`)
            .join(" ");
        const last = attempts.length - 1;
        return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
            <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linejoin="round" stroke-linecap="round"></polyline>
            <circle cx="${xFor(last).toFixed(1)}" cy="${yFor(attempts[last].seconds).toFixed(1)}"
                r="2.5" fill="currentColor"></circle>
        </svg>`;
    }

    /** 展开后的趋势折线图：x 为 AC 次序，y 为用时 */
    private renderTrendChart(trend: IProblemTrend): string {
        if (trend.attempts.length < 2) {
            return `<div class="trend-empty">${l10n.t("No trend yet (only one AC).")}</div>`;
        }

        const width = 640;
        const height = 180;
        const padLeft = 56;
        const padRight = 16;
        const padTop = 16;
        const padBottom = 28;
        const innerWidth = width - padLeft - padRight;
        const innerHeight = height - padTop - padBottom;

        const values = trend.attempts.map((attempt) => attempt.seconds);
        const rawMin = Math.min(...values);
        const rawMax = Math.max(...values);
        const padding = Math.max((rawMax - rawMin) * 0.15, 5);
        const yMin = Math.max(0, Math.floor(rawMin - padding));
        const yMax = Math.ceil(rawMax + padding);
        const yFor = (value: number): number => padTop + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
        const xFor = (index: number): number => padLeft + (index / (values.length - 1)) * innerWidth;

        const points = trend.attempts
            .map((attempt, index) => `${xFor(index).toFixed(1)},${yFor(attempt.seconds).toFixed(1)}`)
            .join(" ");

        const gridValues = [yMax, (yMax + yMin) / 2, yMin];
        const grid = gridValues
            .map(
                (value) => `
                <line x1="${padLeft}" y1="${yFor(value).toFixed(1)}" x2="${padLeft + innerWidth}"
                    y2="${yFor(value).toFixed(1)}" class="chart-grid"></line>
                <text x="${padLeft - 8}" y="${(yFor(value) + 4).toFixed(1)}" text-anchor="end" class="chart-label">${formatDuration(
                    value
                )}</text>`
            )
            .join("");

        const dots = trend.attempts
            .map(
                (attempt, index) => `
                <circle cx="${xFor(index).toFixed(1)}" cy="${yFor(attempt.seconds).toFixed(1)}" r="4"
                    class="chart-dot">
                    <title>${escapeHtml(formatDateTime(attempt.acceptedAt))} · ${formatDuration(
                        attempt.seconds
                    )}</title>
                </circle>`
            )
            .join("");

        const firstDate = formatShortDate(trend.attempts[0].acceptedAt);
        const lastDate = formatShortDate(trend.attempts[trend.attempts.length - 1].acceptedAt);

        return `<svg class="trend-chart ${trend.trend}" viewBox="0 0 ${width} ${height}" role="img"
            aria-label="${escapeHtml(l10n.t("Answer time trend"))}">
            ${grid}
            <polyline points="${points}" class="chart-line"></polyline>
            ${dots}
            <text x="${padLeft}" y="${height - 8}" text-anchor="start" class="chart-label">${escapeHtml(
                firstDate
            )}</text>
            <text x="${padLeft + innerWidth}" y="${height - 8}" text-anchor="end" class="chart-label">${escapeHtml(
                lastDate
            )}</text>
        </svg>`;
    }

    /** 展开后的 AC 明细；新记录在前，并标出与上一次相比快了/慢了多少 */
    private renderAttemptList(attempts: ITimerAttempt[]): string {
        const reversed = [...attempts].reverse();
        const rows = reversed
            .map((attempt, index) => {
                const older = reversed[index + 1];
                let delta = "";
                if (older) {
                    const diff = attempt.seconds - older.seconds;
                    if (diff !== 0) {
                        const className = diff < 0 ? "faster" : "slower";
                        const sign = diff < 0 ? "−" : "+";
                        delta = `<span class="attempt-delta ${className}">${sign}${formatDuration(
                            Math.abs(diff)
                        )}</span>`;
                    }
                }
                return `
                    <li>
                        <span class="attempt-date">${escapeHtml(formatDateTime(attempt.acceptedAt))}</span>
                        <span class="attempt-time">${formatDuration(attempt.seconds)}</span>
                        ${delta}
                    </li>`;
            })
            .join("");

        return `
            <div class="attempt-list-header">${l10n.t("AC records (newest first)")}</div>
            <ul class="attempt-list">${rows}</ul>`;
    }
}
