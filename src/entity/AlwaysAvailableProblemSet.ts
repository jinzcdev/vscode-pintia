import { IProblemSet } from "./IProblemSet";
import { IProblemSummary } from "./IProblemSummary";

interface ExamConfig {
}

interface Exam {
    id: string;
    score: number;
    startAt: string;
    endAt: string;
    acceptCount: number;
    examConfig: ExamConfig;
    problemSetId: string;
    userId: string;
    ended: boolean;
    status: string;
    resetStatus: boolean;
    adjustAmount: number;
    adjustedScore: number;
}

interface ProblemSetSummary {
    summariesByPaperIndex: {
        [index: string]: {
            summaryByProblemType: IProblemSummary;
        };
    };
}


export interface AlwaysAvailableProblemSet {
    problemSets: IProblemSet[];
    examByProblemSetId: { [id: string]: Exam };
    problemSetSummaryByProblemSetId: { [id: string]: ProblemSetSummary };
}