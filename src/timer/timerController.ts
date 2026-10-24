import * as vscode from "vscode";
import { Disposable, l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { IPtaProblem, ITimerAttempt, TimerState } from "../shared";
import { formatDuration } from "../utils/durationUtils";
import { getActiveProblem, getProblemFromDocument } from "../utils/editorUtils";
import { PtaTimerStatsProvider } from "../webview/PtaTimerStatsProvider";
import { timerManager, TimerManager } from "./timerManager";
import { ITimerStatusBarView, timerStatusBar } from "./timerStatusBar";

/** 提交时捕获的本次计时快照，评测结束后用它落记录 */
export interface IAcceptedSession {
    seconds: number;
    psName: string;
    title: string;
}

/**
 * 手动计时的编排层。
 *
 * 计时完全由用户控制：状态栏单击开始/暂停/继续，切换文件不会自动暂停。
 * 这里只做三件事：把点击转给 manager、刷新状态栏、在提交 AC 后落记录并通知。
 *
 * 所有会写盘的操作进入同一个 Promise 队列，避免「评测回调」与「用户点击」交错；
 * 通知本身不放在队列里——`showInformationMessage` 会等到用户处理完才 resolve。
 */
export class TimerController implements Disposable {
    private queue: Promise<void> = Promise.resolve();
    private current?: IPtaProblem;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly onStateChanged = (): void => this.refreshView();

    public constructor(
        private readonly manager: TimerManager = timerManager,
        private readonly view: ITimerStatusBarView = timerStatusBar
    ) {
        this.disposables.push(
            // 只用来刷新「当前题目」的空闲显示，不做任何自动开始/暂停
            vscode.window.onDidChangeActiveTextEditor(() => this.refreshView()),
            // 关闭正在计时的题目文件时暂停：否则计时会继续走，用户很容易忘记
            vscode.workspace.onDidCloseTextDocument((document) => this.onDocumentClosed(document)),
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration("pintia.timer.enableStatusBar")) {
                    this.refreshView();
                }
            })
        );
        this.manager.on("stateChanged", this.onStateChanged);
        this.refreshView();
    }

    /** 状态栏单击：有活动计时器就切换它，否则为当前题目开始计时 */
    public toggle(): Promise<boolean> {
        return this.enqueue(async () => {
            const active = this.manager.getActiveTimer();
            if (active) {
                await this.manager.toggle(this.toProblem(active));
                return true;
            }
            const current = getActiveProblem();
            if (!current) {
                return false;
            }
            await this.manager.start(current);
            return true;
        });
    }

    /**
     * 针对指定题目切换计时（CodeLens 使用）。
     *
     * 与 `toggle()` 的区别是不依赖当前活动编辑器：即使点击的是分屏里非焦点的
     * 题目文件，也能准确操作那道题。若另一题正在计时，`manager.start` 会丢弃
     * 旧会话——调用方应先向用户确认。
     */
    public toggleFor(problem: IPtaProblem): Promise<void> {
        return this.enqueue(() => this.manager.toggle(problem));
    }

    /** 结束当前计时但不记录（未 AC 的计时不进入统计） */
    public discardActive(): Promise<void> {
        return this.enqueue(() => this.manager.discardActive());
    }

    /** 为当前题目开始计时；若另一题正在计时，旧会话会被丢弃 */
    public startCurrentProblem(): Promise<boolean> {
        return this.enqueue(async () => {
            const current = getActiveProblem();
            if (!current) {
                return false;
            }
            await this.manager.start(current);
            return true;
        });
    }

    /**
     * 提交 AC 后调用：落一条本次用时记录、刷新统计页、弹出恭喜通知。
     *
     * 使用提交时捕获的 `session`，因此评测期间继续计时不会改变本次耗时；
     * 只有计时处于活动状态（Running/Paused）且时长大于 0 时才会记录。
     */
    public async handleAccepted(
        psID: string,
        pID: string,
        submissionId: string,
        session: IAcceptedSession,
        acceptedAt?: string
    ): Promise<ITimerAttempt | undefined> {
        const attempt = await this.enqueue(() =>
            this.manager.recordAccepted({
                submissionId,
                psID,
                pID,
                psName: session.psName,
                title: session.title,
                seconds: session.seconds,
                acceptedAt,
            })
        );
        if (!attempt) {
            return undefined;
        }

        // 统计页若已打开则静默刷新；没打开时 show(false) 不会创建新面板
        void PtaTimerStatsProvider.createOrUpdate(this.manager.getAttempts()).show(false);
        // 通知不阻塞提交流程：评测进度不应等用户关掉提示
        void this.notifyAccepted(attempt).catch((error: any) => this.report(error));
        return attempt;
    }

    private async notifyAccepted(attempt: ITimerAttempt): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            l10n.t("Congratulations, you passed! Total time spent: {0}", formatDuration(attempt.seconds)),
            l10n.t("Show Time Spent")
        );
        if (choice) {
            await vscode.commands.executeCommand("pintia.showTimerStats");
        }
    }

    /** 当前活动编辑器解析出的题目（菜单用来判断是否显示「为当前题目开始计时」） */
    public getCurrentProblem(): IPtaProblem | undefined {
        return this.current;
    }

    /** 当前正在计时/已暂停的题目 */
    public getActiveProblem(): IPtaProblem | undefined {
        const active = this.manager.getActiveTimer();
        return active ? this.toProblem(active) : undefined;
    }

    public dispose(): void {
        this.manager.off("stateChanged", this.onStateChanged);
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.view.dispose();
    }

    // ---------- 内部 ----------

    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        // 前一个任务失败不应卡死队列，因此成功/失败都接着执行
        const run = this.queue.then(task, task);
        this.queue = run.then(
            () => undefined,
            (error: any) => this.report(error)
        );
        return run;
    }

    private report(error: any): void {
        ptaChannel.error(error?.toString?.() ?? String(error));
    }

    /**
     * 关闭文档时，若正是当前计时的那道题，自动暂停并提示。
     *
     * 只暂停不结束：重新打开后点一下即可接着计时，已计的时长不会丢，
     * 也不会把关闭期间算进去。关闭其它文档不受影响。
     */
    private onDocumentClosed(document: vscode.TextDocument): Promise<void> {
        return this.enqueue(async () => {
            const closed = getProblemFromDocument(document);
            const active = this.manager.getActiveTimer();
            if (!closed || !active) {
                return;
            }
            if (closed.psID !== active.psID || closed.pID !== active.pID) {
                return;
            }
            if (this.manager.getState(active.psID, active.pID) !== TimerState.Running) {
                return;
            }

            const seconds = this.manager.getSessionSeconds(active.psID, active.pID);
            await this.manager.pause(active.psID, active.pID);
            void vscode.window.showInformationMessage(
                l10n.t(
                    'Timing for "{0}" paused ({1}) because the problem file was closed.',
                    active.title || active.pID,
                    formatDuration(seconds)
                )
            );
        });
    }

    private toProblem(active: { psID: string; pID: string; psName: string; title: string }): IPtaProblem {
        return { psID: active.psID, pID: active.pID, psName: active.psName, title: active.title };
    }

    /**
     * 状态栏显示对象：活动计时器优先（切到别的文件也继续显示），
     * 否则显示当前题目（仅题目文件可见）。
     */
    private refreshView(): void {
        const current = getActiveProblem();
        this.current = current;
        const active = this.manager.getActiveTimer();
        const display = active ? this.toProblem(active) : current;
        this.view.update(display, !!display && ptaConfig.getTimerEnableStatusBar());
    }
}

export const timerController = new TimerController();
