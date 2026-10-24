import * as fs from "fs-extra";
import * as path from "path";
import { Disposable, l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";

import { ProblemBasicInfo } from "../entity/ProblemBasicInfo";
import { ptaConfig } from "../ptaConfig";
import { ptaManager } from "../ptaManager";
import { viewedProblemPath } from "../shared";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

export class HistoryManager implements Disposable {
    private static instance: HistoryManager;
    private viewedProblems: Record<string, ProblemBasicInfo[]> = {};
    private readonly filePath: string;

    /** `filePath` 可注入，便于用临时目录测试；生产走下方共享单例 */
    public constructor(filePath: string = viewedProblemPath) {
        this.filePath = filePath;
        this.load();
    }

    public static getInstance(): HistoryManager {
        if (!HistoryManager.instance) {
            HistoryManager.instance = new HistoryManager();
        }
        return HistoryManager.instance;
    }

    public async addProblem(userId: string, problem: ProblemBasicInfo): Promise<void> {
        if (!this.viewedProblems[userId]) {
            this.viewedProblems[userId] = [];
        }
        const problems = this.viewedProblems[userId];
        const index = problems.findIndex((p) => p.pID === problem.pID);
        if (index >= 0) {
            problems.splice(index, 1);
        }
        problems.unshift(problem);
        this.trimViewedProblemsForUser(userId);
        await this.save();
    }

    public getProblemHistory(userId: string): ProblemBasicInfo[] {
        return this.viewedProblems[userId] ?? [];
    }

    private load(): void {
        try {
            if (!fs.existsSync(this.filePath)) {
                // 刻意不在读取路径上创建文件：空文件由首次 save() 落盘
                return;
            }
            this.viewedProblems = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
            this.trimViewedProblems();
        } catch (error: any) {
            ptaChannel.error(error.toString());
            promptForOpenOutputChannel(
                l10n.t("Failed to load viewed problems. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    /**
     * 原子落盘：先写临时文件再改名，避免写到一半被中断时留下半截 JSON。
     *
     * 每次变更都立即保存——此前只在 dispose() 里保存，而 VS Code 退出时
     * 不保证 await 扩展的 dispose，会话内浏览过的题目会直接丢失。
     */
    private async save(): Promise<void> {
        const tempPath = `${this.filePath}.tmp`;
        try {
            await fs.ensureDir(path.dirname(this.filePath));
            await fs.writeJson(tempPath, this.viewedProblems);
            await fs.rename(tempPath, this.filePath);
        } catch (error: any) {
            ptaChannel.error(error.toString());
            await promptForOpenOutputChannel(
                l10n.t("Failed to save viewed problems. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    private trimViewedProblems() {
        for (const userId in this.viewedProblems) {
            this.trimViewedProblemsForUser(userId);
        }
    }

    private trimViewedProblemsForUser(userId: string) {
        const maxSize = ptaConfig.getProblemHistoryListSize();
        if (this.viewedProblems[userId].length > maxSize) {
            this.viewedProblems[userId] = this.viewedProblems[userId].slice(0, maxSize);
        }
    }

    public getCurrentUserId(): string {
        return ptaManager.getUserSession()?.id ?? "";
    }

    public async dispose(): Promise<void> {
        await this.save();
    }

    /**
     * 清空当前用户的浏览历史。刷新视图由命令层负责——本类不 import tree provider，
     * 否则两者互相 import 成环。
     */
    public async clearViewedProblems(): Promise<void> {
        this.viewedProblems[this.getCurrentUserId()] = [];
        await this.save();
    }

    /**
     * 按当前配置的上限裁剪全部用户的历史。
     * 配置变更由 `extension.ts` 监听后调用（本类不自行注册监听，避免与视图刷新耦合）。
     */
    public trimAll(): void {
        this.trimViewedProblems();
    }
}

export const historyManager = HistoryManager.getInstance();
