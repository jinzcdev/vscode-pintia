// https://pintia.cn/api/problem-sets/${psID}/exam-problem-status
export interface IExamProblemStatus {
    id: string;
    label: string;
    score: number;
    problemSubmissionStatus: string;
    problemType: string;
    problemPoolIndex: number;
    indexInProblemPool: number;
}