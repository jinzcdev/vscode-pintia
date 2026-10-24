import * as vscode from "vscode";
import { Disposable, l10n } from "vscode";
import { IPtaProblem, TimerState } from "../shared";
import { formatDuration } from "../utils/durationUtils";
import { timerManager, TimerManager } from "./timerManager";

/** 控制器只依赖这两个方法，测试可注入假 view，无需创建真实状态栏项 */
export interface ITimerStatusBarView extends Disposable {
    update(problem: IPtaProblem | undefined, visible: boolean): void;
}

/**
 * 状态栏计时器（纯视图）。
 *
 * 是否开始、暂停、记录全部由 `TimerController` 决定；这里只负责：
 * 显示哪道题、三态文案、tooltip，以及运行中每秒刷新。
 */
export class TimerStatusBar implements ITimerStatusBarView {
    private readonly item: vscode.StatusBarItem;
    private ticker?: ReturnType<typeof setInterval>;
    private current?: IPtaProblem;

    public constructor(private readonly manager: TimerManager = timerManager) {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        // 单击只做开始 / 暂停 / 继续；其它动作统一收进命令面板的计时菜单
        this.item.command = "pintia.toggleTimer";
        this.item.name = l10n.t("Pintia Timer");
    }

    /** `problem` 由控制器决定：有活动计时器时传活动计时器，否则传当前题目 */
    public update(problem: IPtaProblem | undefined, visible: boolean): void {
        this.current = problem;

        if (!problem || !visible) {
            this.stopTicker();
            this.item.hide();
            return;
        }

        this.render();
        this.item.show();

        if (this.manager.getState(problem.psID, problem.pID) === TimerState.Running) {
            this.startTicker();
        } else {
            this.stopTicker();
        }
    }

    public dispose(): void {
        this.stopTicker();
        this.item.dispose();
    }

    private startTicker(): void {
        if (this.ticker) {
            return;
        }
        // tick 必须是同步的：只重写状态栏文本，不做任何异步工作。
        // 这个仓库此前两处「轮询永不终止」都是 setInterval(async ...) 造成的。
        this.ticker = setInterval(() => this.render(), 1000);
    }

    private stopTicker(): void {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = undefined;
        }
    }

    private render(): void {
        const current = this.current;
        if (!current) {
            return;
        }
        const { psID, pID } = current;
        const state = this.manager.getState(psID, pID);
        const session = this.manager.getSessionSeconds(psID, pID);

        switch (state) {
            case TimerState.Running:
                this.item.text = `$(watch) ${this.displayLabel(current)} · ${formatDuration(session)}`;
                break;
            case TimerState.Paused:
                this.item.text = `$(debug-pause) ${this.displayLabel(current)} · ${formatDuration(session)}`;
                break;
            default:
                this.item.text = `$(watch) ${l10n.t("Timer")}`;
        }

        this.item.tooltip = this.buildTooltip(state, session);
    }

    /** 状态栏宽度有限：长题目截断，完整名称在 tooltip 里 */
    private displayLabel(problem: IPtaProblem): string {
        const title = problem.title || problem.pID || l10n.t("Timer");
        return title.length > 20 ? `${title.slice(0, 19)}…` : title;
    }

    private buildTooltip(state: TimerState, session: number): vscode.MarkdownString {
        const current = this.current!;
        const lines: string[] = [];

        if (state !== TimerState.Idle) {
            lines.push(l10n.t("This session: {0}", formatDuration(session)));
        }
        const latest = this.manager.getLatestAttempt(current.psID, current.pID);
        if (latest) {
            lines.push(l10n.t("Last AC: {0}", formatDuration(latest.seconds)));
        } else if (state === TimerState.Idle) {
            lines.push(l10n.t("No accepted record for this problem yet."));
        }

        const where = [current.psName, current.title].filter(Boolean).join(" · ");
        if (where) {
            lines.push(where);
        }

        const hint =
            state === TimerState.Running
                ? l10n.t("Click to pause")
                : state === TimerState.Paused
                  ? l10n.t("Click to resume")
                  : l10n.t("Click to start");
        const menu = `[${l10n.t("Timer menu…")}](command:pintia.timerMenu)`;
        lines.push(`${hint} · ${menu}`);

        const markdown = new vscode.MarkdownString(lines.join("  \n\n"));
        // 只放行菜单命令；对象形式在旧版 VS Code 上退化为「可信」，同样安全
        markdown.isTrusted = { enabledCommands: ["pintia.timerMenu"] };
        markdown.supportThemeIcons = true;
        return markdown;
    }
}

export const timerStatusBar = new TimerStatusBar();
