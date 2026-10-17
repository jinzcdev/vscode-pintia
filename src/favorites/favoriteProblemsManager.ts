import * as fs from "fs-extra";
import * as path from "path";
import { Disposable, l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";

import { favoriteProblemsPath } from "../shared";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { ptaManager } from "../ptaManager";
import { ProblemBasicInfo } from "../entity/ProblemBasicInfo";

export class FavoriteProblemsManager implements Disposable {
    private static instance: FavoriteProblemsManager;
    private favoriteProblems: Record<string, ProblemBasicInfo[]> = {};
    private readonly filePath: string;

    /** `filePath` 可注入，便于用临时目录测试；生产走下方共享单例 */
    public constructor(filePath: string = favoriteProblemsPath) {
        this.filePath = filePath;
        this.load();
    }

    public static getInstance(): FavoriteProblemsManager {
        if (!FavoriteProblemsManager.instance) {
            FavoriteProblemsManager.instance = new FavoriteProblemsManager();
        }
        return FavoriteProblemsManager.instance;
    }

    public async addFavoriteProblem(userId: string, problem: ProblemBasicInfo): Promise<void> {
        if (this.isFavoriteProblem(userId, problem.pID)) {
            return;
        }
        if (!this.favoriteProblems[userId]) {
            this.favoriteProblems[userId] = [];
        }
        this.favoriteProblems[userId].push(problem);
        await this.save();
    }

    public async removeFavoriteProblem(userId: string, pID: string): Promise<void> {
        const problems = this.favoriteProblems[userId];
        if (!problems) {
            return;
        }
        const index = problems.findIndex((p) => p.pID === pID);
        if (index < 0) {
            return;
        }
        problems.splice(index, 1);
        await this.save();
    }

    public getFavoriteProblems(userId: string): ProblemBasicInfo[] {
        return this.favoriteProblems[userId] ?? [];
    }

    public isFavoriteProblem(userId: string, pID: string): boolean {
        const problems = this.favoriteProblems[userId] || [];
        return problems.some((p) => p.pID === pID);
    }

    private load(): void {
        try {
            if (!fs.existsSync(this.filePath)) {
                // 刻意不在读取路径上创建文件：空文件由首次 save() 落盘，
                // 否则仅仅激活一次扩展就会在用户目录里留下一个空 JSON
                return;
            }
            this.favoriteProblems = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
        } catch (error: any) {
            ptaChannel.error(error.toString());
            promptForOpenOutputChannel(
                l10n.t("Failed to load favorite problems. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    /**
     * 原子落盘：先写临时文件再改名，避免写到一半被中断时留下半截 JSON。
     *
     * 每次变更都立即保存——此前只在 dispose() 里保存，而 VS Code 退出时
     * 不保证 await 扩展的 dispose，会话内新增的收藏会直接丢失。
     */
    private async save(): Promise<void> {
        const tempPath = `${this.filePath}.tmp`;
        try {
            await fs.ensureDir(path.dirname(this.filePath));
            await fs.writeJson(tempPath, this.favoriteProblems);
            await fs.rename(tempPath, this.filePath);
        } catch (error: any) {
            ptaChannel.error(error.toString());
            await promptForOpenOutputChannel(
                l10n.t("Failed to save favorite problems. Please check the output channel for details."),
                DialogType.error
            );
        }
    }

    public getCurrentUserId(): string {
        return ptaManager.getUserSession()?.id ?? "";
    }

    public async dispose(): Promise<void> {
        await this.save();
    }

    /**
     * 清空当前用户的收藏。刷新视图由命令层负责——本类不 import tree provider，
     * 否则两者互相 import 成环。
     */
    public async clearFavoriteProblems(): Promise<void> {
        this.favoriteProblems[this.getCurrentUserId()] = [];
        await this.save();
    }
}

export const favoriteProblemsManager = FavoriteProblemsManager.getInstance();
