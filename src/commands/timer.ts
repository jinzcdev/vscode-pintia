import * as vscode from "vscode";
import { l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { IPtaProblem, TimerState } from "../shared";
import { timerController } from "../timer/timerController";
import { timerManager } from "../timer/timerManager";
import { formatDuration } from "../utils/durationUtils";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaTimerStatsProvider } from "../webview/PtaTimerStatsProvider";

type TimerMenuAction = "toggle" | "discard" | "start-current" | "stats";

interface ITimerMenuItem extends vscode.QuickPickItem {
    action: TimerMenuAction;
}

function isSameProblem(a: IPtaProblem, b: IPtaProblem): boolean {
    return a.psID === b.psID && a.pID === b.pID;
}

function problemLabel(problem: IPtaProblem): string {
    return problem.title || problem.pID;
}

function problemWhere(problem: IPtaProblem): string {
    return [problem.psName, problem.title].filter(Boolean).join(" · ");
}

/** 状态栏单击 / 命令面板：开始、暂停或继续计时 */
export async function toggleTimer(): Promise<void> {
    try {
        const handled = await timerController.toggle();
        if (!handled) {
            vscode.window.showWarningMessage(l10n.t("The current file is not a Pintia problem."));
        }
    } catch (error: any) {
        ptaChannel.error(error.toString());
        await promptForOpenOutputChannel(
            l10n.t("Failed to update the timer. Please check the output channel for details."),
            DialogType.error
        );
    }
}

/**
 * CodeLens 入口：为指定题目开始 / 暂停 / 继续计时。
 *
 * 与状态栏单击不同，这里不依赖当前活动编辑器，点击哪个文件的 CodeLens
 * 就操作哪道题。若另一题正在计时，先确认是否丢弃它的本次计时。
 */
export async function toggleTimerForProblem(problem: IPtaProblem): Promise<void> {
    const active = timerController.getActiveProblem();
    if (active && !isSameProblem(active, problem)) {
        const confirmed = await vscode.window.showWarningMessage(
            l10n.t(
                '"{0}" is being timed. Starting timing for "{1}" will discard that session. Continue?',
                problemLabel(active),
                problemLabel(problem)
            ),
            { modal: true },
            l10n.t("Start Timing")
        );
        if (!confirmed) {
            return;
        }
    }

    try {
        await timerController.toggleFor(problem);
    } catch (error: any) {
        ptaChannel.error(error.toString());
        await promptForOpenOutputChannel(
            l10n.t("Failed to update the timer. Please check the output channel for details."),
            DialogType.error
        );
    }
}

/**
 * 计时器统一菜单：暂停/继续、结束本次计时、为当前题目开始计时、查看答题耗时。
 *
 * 状态栏只能挂一个命令（单击切换计时），结束与统计等低频操作收在这里。
 */
export async function showTimerMenu(): Promise<void> {
    const active = timerController.getActiveProblem();
    const current = timerController.getCurrentProblem();
    const items: ITimerMenuItem[] = [];

    if (active) {
        const state = timerManager.getState(active.psID, active.pID);
        items.push({
            label: state === TimerState.Running ? `$(debug-pause) ${l10n.t("Pause")}` : `$(play) ${l10n.t("Resume")}`,
            description: l10n.t(
                "This session: {0}",
                formatDuration(timerManager.getSessionSeconds(active.psID, active.pID))
            ),
            action: "toggle",
        });
        items.push({
            label: `$(check) ${l10n.t("End Timing")}`,
            detail: l10n.t("Timing that is not accepted will not be recorded."),
            action: "discard",
        });
    }

    if (current && (!active || !isSameProblem(active, current))) {
        items.push({
            label: `$(watch) ${l10n.t("Start Timing for This Problem")}`,
            action: "start-current",
        });
    }

    items.push({
        label: `$(graph) ${l10n.t("Show Time Spent")}`,
        action: "stats",
    });

    if (!active && !current && timerManager.getAttempts().length === 0) {
        vscode.window.showInformationMessage(l10n.t("No timing records yet."));
        return;
    }

    const placeHolder = current ? problemWhere(current) : active ? problemWhere(active) : l10n.t("Timer menu");
    const choice = await vscode.window.showQuickPick(items, { placeHolder });
    if (!choice) {
        return;
    }

    switch (choice.action) {
        case "toggle":
            await toggleTimer();
            break;
        case "discard":
            if (active) {
                await discardActiveTiming(active);
            }
            break;
        case "start-current":
            if (current) {
                await startCurrentTiming(active, current);
            }
            break;
        case "stats":
            await vscode.commands.executeCommand("pintia.showTimerStats");
            break;
    }
}

async function discardActiveTiming(active: IPtaProblem): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
        l10n.t('End the timing for "{0}"? Timing that is not accepted will not be recorded.', problemLabel(active)),
        { modal: true },
        l10n.t("End Timing")
    );
    if (!confirmed) {
        return;
    }
    try {
        await timerController.discardActive();
        vscode.window.showInformationMessage(l10n.t("Timing ended."));
    } catch (error: any) {
        ptaChannel.error(error.toString());
        await promptForOpenOutputChannel(
            l10n.t("Failed to update the timer. Please check the output channel for details."),
            DialogType.error
        );
    }
}

async function startCurrentTiming(active: IPtaProblem | undefined, current: IPtaProblem): Promise<void> {
    if (active) {
        const confirmed = await vscode.window.showWarningMessage(
            l10n.t(
                '"{0}" is being timed. Starting timing for "{1}" will discard that session. Continue?',
                problemLabel(active),
                problemLabel(current)
            ),
            { modal: true },
            l10n.t("Start Timing")
        );
        if (!confirmed) {
            return;
        }
    }
    try {
        const started = await timerController.startCurrentProblem();
        if (!started) {
            vscode.window.showWarningMessage(l10n.t("The current file is not a Pintia problem."));
        }
    } catch (error: any) {
        ptaChannel.error(error.toString());
        await promptForOpenOutputChannel(
            l10n.t("Failed to update the timer. Please check the output channel for details."),
            DialogType.error
        );
    }
}

/** 打开答题耗时统计页 */
export async function showTimerStats(): Promise<void> {
    await PtaTimerStatsProvider.createOrUpdate(timerManager.getAttempts()).show();
}
