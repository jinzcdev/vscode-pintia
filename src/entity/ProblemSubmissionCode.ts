
export interface IProblemCode {
    details: IProblemSubmissionDetail[];
    problemType: string; // PROGRAMMING or CODE_COMPLETION
}

export interface IProblemSubmissionDetail {
    problemId: string,
    problemSetProblemId: string,
    programmingSubmissionDetail: {
        compiler: string;
        program: string;
    }
}