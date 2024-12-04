
import * as fs from 'fs-extra';
import * as path from 'path';
import { Disposable } from 'vscode';
import { IFavoriteProblem } from './IFavoriteProblem';
import { ptaChannel } from '../ptaChannel';

import { favoriteProblemsPath } from '../shared';
import { DialogType, promptForOpenOutputChannel } from '../utils/uiUtils';
import { ptaManager } from '../ptaManager';


class FavoriteProblemsManager implements Disposable {
    private static instance: FavoriteProblemsManager;
    private favoriteProblems: Record<string, IFavoriteProblem[]> = {};
    private filePath: string;

    private constructor() {
        this.filePath = favoriteProblemsPath;
        this.load();
    }

    public static getInstance(): FavoriteProblemsManager {
        if (!FavoriteProblemsManager.instance) {
            FavoriteProblemsManager.instance = new FavoriteProblemsManager();
        }
        return FavoriteProblemsManager.instance;
    }

    public addFavoriteProblem(userId: string, problem: IFavoriteProblem) {
        if (!this.isProblemFavorite(userId, problem.pID)) {
            if (!this.favoriteProblems[userId]) {
                this.favoriteProblems[userId] = [];
            }
            this.favoriteProblems[userId].push(problem);
        }
    }

    public removeFavoriteProblem(userId: string, pID: string) {
        const problems = this.favoriteProblems[userId];
        if (problems) {
            const index = problems.findIndex(p => p.pID === pID);
            if (index >= 0) {
                problems.splice(index, 1);
                this.save();
            }
        }
    }

    public getFavoriteProblems(userId: string): IFavoriteProblem[] {
        return this.favoriteProblems[userId] ?? [];
    }

    public isProblemFavorite(userId: string, pID: string): boolean {
        const problems = this.favoriteProblems[userId] || [];
        return problems.some(p => p.pID === pID);
    }

    private async load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
                fs.writeFileSync(this.filePath, JSON.stringify({}));
            } else {
                const data = fs.readFileSync(this.filePath, 'utf-8');
                this.favoriteProblems = JSON.parse(data);
            }
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            await promptForOpenOutputChannel("Failed to load favorite problems. Please open the output channel for details.", DialogType.error);
        }
    }


    private async save() {
        try {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(this.favoriteProblems));
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            await promptForOpenOutputChannel("Failed to save favorite problems. Please open the output channel for details.", DialogType.error);
        }
    }

    public getCurrentUserId(): string {
        return ptaManager.getUserSession()?.id ?? "";
    }


    public async dispose() {
        await this.save();
    }
}

export const favoriteProblemsManager = FavoriteProblemsManager.getInstance();
