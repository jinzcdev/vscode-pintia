
import * as fs from 'fs-extra';
import * as path from 'path';
import { Disposable } from 'vscode';
import { HistoryProblem } from './HistoryProblem';
import { ptaChannel } from '../ptaChannel';

import { viewedProblemPath } from '../shared';
import { DialogType, promptForOpenOutputChannel } from '../utils/uiUtils';
import { ptaManager } from '../ptaManager';


class HistoryManager implements Disposable {
    private static instance: HistoryManager;
    private viewedProblems: Record<string, HistoryProblem[]> = {};
    private readonly filePath: string;

    private constructor() {
        this.filePath = viewedProblemPath;
        this.load();
    }

    public static getInstance(): HistoryManager {
        if (!HistoryManager.instance) {
            HistoryManager.instance = new HistoryManager();
        }
        return HistoryManager.instance;
    }

    public addProblem(userId: string, problem: HistoryProblem) {
        if (!this.viewedProblems[userId]) {
            this.viewedProblems[userId] = [];
        }
        const problems = this.viewedProblems[userId];
        const index = problems.findIndex(p => p.pID === problem.pID);
        if (index >= 0) {
            problems.splice(index, 1);
        }
        problems.unshift(problem);
        if (problems.length > 200) {
            problems.pop();
        }
    }

    public getProblemHistory(userId: string): HistoryProblem[] {
        return this.viewedProblems[userId] || [];
    }

    private async load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
                fs.writeFileSync(this.filePath, JSON.stringify({}));
            } else {
                const data = fs.readFileSync(this.filePath, 'utf-8');
                this.viewedProblems = JSON.parse(data);
            }
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            await promptForOpenOutputChannel("Failed to load viewed problems. Please check the output channel for details.", DialogType.error);
        }
    }


    private async save() {
        try {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(this.viewedProblems));
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            await promptForOpenOutputChannel("Failed to save viewed problems. Please check the output channel for details.", DialogType.error);
        }
    }

    public getCurrentUserId(): string {
        return ptaManager.getUserSession()?.id ?? "";
    }


    public async dispose() {
        await this.save();
    }
}

export const historyManager = HistoryManager.getInstance();
