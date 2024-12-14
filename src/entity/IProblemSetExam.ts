
export interface IProblemSetExam {
    status: string;
    exam?: IExam;
}

export interface IExam {
    id: string;
    score: number;
    startAt: string;
    endAt: string;
    examConfig: {};
    problemSetId: string;
    userId: string;
    ended: boolean;
    existsSubmissionsNotCompleted: boolean;
    status: string;
}
