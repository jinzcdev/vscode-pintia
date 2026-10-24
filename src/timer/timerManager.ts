import { EventEmitter } from "events";
import * as fs from "fs-extra";
import * as path from "path";
import { Disposable, l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import {
    IActiveTimer,
    IPtaProblem,
    ITimerAttempt,
    ITimerFile,
    TIMER_FILE_VERSION,
    timerPath,
    TimerState,
} from "../shared";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

/** 计时记录在 attempts 里的题目标识 */
export function timerKey(psID: string, pID: string): string {
    return `${psID}|${pID}`;
}

/** `recordAccepted` 的入参：acceptedAt 可由调用方指定（提交时间） */
export type TimerAttemptInput = Omit<ITimerAttempt, "acceptedAt" | "seconds"> & {
    seconds: number;
    acceptedAt?: string;
};

/**
 * 答题计时。
 *
 * 手动模式：用户开始/暂停，计时只累计运行中的时间；同一时刻最多只有一个活动计时器。
 * 只有提交 AC 时才落一条 `attempts`——不做按题累加，统计页需要的是「每次 AC 各花了多久」。
 *
 * 刻意不 import 任何 vscode UI：状态与持久化都在这里，自动计时策略在
 * `timerController`，界面由 `timerStatusBar` 与 `commands/timer` 承担，
 * 因此本类可以直接单测。
 */
export class TimerManager extends EventEmitter implements Disposable {
    private static instance: TimerManager;
    private attempts: ITimerAttempt[] = [];
    private active: IActiveTimer | undefined;
    private readonly filePath: string;
    /** 落盘串行化：严格的临时文件 + rename 也挡不住两次写入交错 */
    private saveChain: Promise<void> = Promise.resolve();

    /** `filePath` 可注入，便于用临时目录测试；生产走下方共享单例 */
    public constructor(filePath: string = timerPath) {
        super();
        this.filePath = filePath;
        this.load();
    }

    public static getInstance(): TimerManager {
        if (!TimerManager.instance) {
            TimerManager.instance = new TimerManager();
        }
        return TimerManager.instance;
    }

    // ---------- 查询 ----------

    public getState(psID: string, pID: string): TimerState {
        if (this.active?.psID !== psID || this.active?.pID !== pID) {
            return TimerState.Idle;
        }
        return this.active.startedAt === null ? TimerState.Paused : TimerState.Running;
    }

    /** 本次会话已计的秒数（空闲时为 0）；暂停期间不增长 */
    public getSessionSeconds(psID: string, pID: string): number {
        if (this.getState(psID, pID) === TimerState.Idle) {
            return 0;
        }
        return Math.floor(this.currentSessionSeconds(this.active!));
    }

    /** 当前活动计时器（只读） */
    public getActiveTimer(): Readonly<IActiveTimer> | undefined {
        return this.active;
    }

    /**
     * 提交时捕获该题的本次用时；没有为本题计时时返回 undefined。
     *
     * 返回快照而不是实时值：评测期间用户继续答题/暂停都不应改变本次提交的耗时。
     */
    public getActiveSession(psID: string, pID: string): { seconds: number; psName: string; title: string } | undefined {
        if (this.getState(psID, pID) === TimerState.Idle) {
            return undefined;
        }
        const active = this.active!;
        return {
            seconds: Math.floor(this.currentSessionSeconds(active)),
            psName: active.psName,
            title: active.title,
        };
    }

    /** 全部 AC 记录，按提交时间倒序 */
    public getAttempts(): ITimerAttempt[] {
        return [...this.attempts].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
    }

    /** 该题最近一次 AC 记录 */
    public getLatestAttempt(psID: string, pID: string): ITimerAttempt | undefined {
        let latest: ITimerAttempt | undefined;
        for (const attempt of this.attempts) {
            if (attempt.psID !== psID || attempt.pID !== pID) {
                continue;
            }
            if (!latest || attempt.acceptedAt > latest.acceptedAt) {
                latest = attempt;
            }
        }
        return latest;
    }

    // ---------- 变更 ----------

    /** 状态栏点击：空闲则开始，运行中则暂停，已暂停则继续 */
    public async toggle(problem: IPtaProblem): Promise<void> {
        const state = this.getState(problem.psID, problem.pID);
        if (state === TimerState.Idle) {
            await this.start(problem);
        } else if (state === TimerState.Running) {
            await this.pause(problem.psID, problem.pID);
        } else {
            await this.resume(problem.psID, problem.pID);
        }
    }

    /**
     * 开始为一道题计时。
     *
     * 同一时刻只保留一个计时器：若另一题正在计时，旧会话直接丢弃——
     * 非 AC 的计时本来就不会进入记录。
     */
    public async start(problem: IPtaProblem): Promise<void> {
        const state = this.getState(problem.psID, problem.pID);
        if (state === TimerState.Running) {
            return;
        }
        if (state === TimerState.Paused) {
            await this.resume(problem.psID, problem.pID);
            return;
        }

        const existing = this.getLatestAttempt(problem.psID, problem.pID);
        this.active = {
            psID: problem.psID,
            pID: problem.pID,
            psName: problem.psName ?? existing?.psName ?? "",
            title: problem.title ?? existing?.title ?? "",
            startedAt: Date.now(),
            elapsedBeforeStart: 0,
        };
        await this.commit();
    }

    public async pause(psID: string, pID: string): Promise<void> {
        if (this.getState(psID, pID) !== TimerState.Running) {
            return;
        }
        const active = this.active!;
        active.elapsedBeforeStart = this.currentSessionSeconds(active);
        active.startedAt = null;
        await this.commit();
    }

    public async resume(psID: string, pID: string): Promise<void> {
        if (this.getState(psID, pID) !== TimerState.Paused) {
            return;
        }
        this.active!.startedAt = Date.now();
        await this.commit();
    }

    /** 结束当前计时但不记录（未 AC 的计时不进入统计） */
    public async discardActive(): Promise<void> {
        if (!this.active) {
            return;
        }
        this.active = undefined;
        await this.commit();
    }

    /**
     * 追加一条 AC 记录，并清空匹配的活动计时器。
     *
     * @returns 新记录；`submissionId` 重复或时长为 0 时返回 undefined（不重复通知）
     */
    public async recordAccepted(input: TimerAttemptInput): Promise<ITimerAttempt | undefined> {
        const seconds = Math.max(0, Math.round(input.seconds));
        if (seconds <= 0) {
            return undefined;
        }
        if (input.submissionId && this.attempts.some((attempt) => attempt.submissionId === input.submissionId)) {
            return undefined;
        }

        const attempt: ITimerAttempt = {
            ...input,
            seconds,
            // 统一成 ISO，保证按字符串排序时与真实时间一致
            acceptedAt: this.normalizeAcceptedAt(input.acceptedAt),
        };
        this.attempts.push(attempt);
        if (this.active?.psID === input.psID && this.active?.pID === input.pID) {
            this.active = undefined;
        }
        await this.commit();
        return attempt;
    }

    // ---------- 内部 ----------

    /** 当前会话已走的秒数（运行中按墙钟差值算，已暂停用累计值） */
    private currentSessionSeconds(active: IActiveTimer): number {
        if (active.startedAt === null) {
            return active.elapsedBeforeStart;
        }
        // 用时间戳差值而非累加 tick：系统休眠、事件循环阻塞都不会让它漂移
        return active.elapsedBeforeStart + (Date.now() - active.startedAt) / 1000;
    }

    /** 提交时间可能是带时区的字符串，统一成 ISO 后排序才可靠 */
    private normalizeAcceptedAt(value: string | undefined): string {
        if (!value) {
            return new Date().toISOString();
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    }

    private async commit(): Promise<void> {
        await this.save();
        this.emit("stateChanged");
    }

    private load(): void {
        try {
            if (!fs.existsSync(this.filePath)) {
                // 读取路径不创建文件，空文件由首次 save() 落盘
                return;
            }
            const raw = fs.readJSONSync(this.filePath) as Partial<ITimerFile> | undefined;
            if (!raw || typeof raw !== "object") {
                return;
            }
            // v1 的 records 是累计值，无法还原成「每次 AC」，直接忽略
            this.attempts = Array.isArray(raw.attempts)
                ? raw.attempts.filter(
                      (attempt): attempt is ITimerAttempt =>
                          !!attempt &&
                          typeof attempt === "object" &&
                          typeof attempt.psID === "string" &&
                          typeof attempt.pID === "string" &&
                          typeof attempt.seconds === "number"
                  )
                : [];
            // 重载窗口后一律恢复为「已暂停」：不把 VS Code 关闭期间算进用时
            if (raw.active?.psID && raw.active?.pID) {
                this.active = { ...raw.active, startedAt: null };
            }
        } catch (error: any) {
            ptaChannel.error(error.toString());
            promptForOpenOutputChannel(
                l10n.t("Failed to load the timer records. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    /**
     * 原子落盘：先写临时文件再改名，避免写到一半被中断时留下半截 JSON。
     *
     * 运行中的计时器存的是「暂停等价」的秒数——磁盘上不留 `startedAt`，
     * 恢复时自然不会把关闭期间算进去。正常关闭/重载会走 `dispose()` 落盘，
     * 因此只有硬崩溃才会丢掉本次未落盘的那一段。
     *
     * 写入通过 `saveChain` 串行：并发写同一个 `.tmp` 会让 rename 失败或写进旧数据。
     */
    private save(): Promise<void> {
        this.saveChain = this.saveChain.then(() => this.writeToDisk());
        return this.saveChain;
    }

    private async writeToDisk(): Promise<void> {
        const tempPath = `${this.filePath}.tmp`;
        try {
            const active = this.active
                ? { ...this.active, elapsedBeforeStart: this.currentSessionSeconds(this.active), startedAt: null }
                : undefined;
            const data: ITimerFile = { version: TIMER_FILE_VERSION, attempts: this.attempts, active };
            await fs.ensureDir(path.dirname(this.filePath));
            await fs.writeJson(tempPath, data);
            await fs.rename(tempPath, this.filePath);
        } catch (error: any) {
            ptaChannel.error(error.toString());
            await promptForOpenOutputChannel(
                l10n.t("Failed to save the timer records. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    public async dispose(): Promise<void> {
        await this.save();
    }
}

export const timerManager = TimerManager.getInstance();
