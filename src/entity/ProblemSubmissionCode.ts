// submit:  https://pintia.cn/api/submissions/{submissionID}
// test:    https://pintia.cn/api/submissions/{submissionID}?custom_test_data_submission=true

export interface IProblemCode {
    details: IProblemSubmissionDetail[];
    problemType: string; // PROGRAMMING or CODE_COMPLETION
}

export interface IProblemSubmissionDetail {
    problemId: string;
    problemSetProblemId: string;
    codeCompletionSubmissionDetail?: SubmissionDetail;
    programmingSubmissionDetail?: SubmissionDetail;
    customTestData?: {
        hasCustomTestData: boolean;
        content: string;
    }
}

interface SubmissionDetail {
    compiler: string;
    program: string;
}