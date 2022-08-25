// submit:  https://pintia.cn/api/submissions/{submissionID}
// test:    https://pintia.cn/api/submissions/{submissionID}?custom_test_data_submission=true

export interface IProblemCode {
    details: IProblemSubmissionDetail[];
    problemType: string; // PROGRAMMING, CODE_COMPLETION, MULTIPLE_FILE
}

export interface IProblemSubmissionDetail {
    problemId: string;
    problemSetProblemId: string;
    codeCompletionSubmissionDetail?: SubmissionDetail;
    programmingSubmissionDetail?: SubmissionDetail;
    multipleFileSubmissionDetail?: MultipleFileSubmissionDetail;

    customTestData?: {
        hasCustomTestData: boolean;
        content: string;
    }
}

interface SubmissionDetail {
    compiler: string;
    program: string;
}

interface MultipleFileSubmissionDetail {
    memoryLimit: number;
    cpuCount: number;
    template: number;
    files: [{
        path: string;
        directory: boolean;
    }],
    judgeZip: string;
    originalScore: number;
    compiles: string[];
    tools: string[];
    withLocalhostNetwork: boolean;
    fileContents: {}
}
