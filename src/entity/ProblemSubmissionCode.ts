
export interface IProblemCode {
    details: IProblemSubmissionDetail[];
    problemType: string; // PROGRAMMING or CODE_COMPLETION
}

export interface IProblemSubmissionDetail {
    problemId: string;
    problemSetProblemId: string;
    codeCompletionSubmissionDetail?: SubmissionDetail;
    programmingSubmissionDetail?: SubmissionDetail;
}

interface SubmissionDetail {
    compiler: string;
    program: string;
}