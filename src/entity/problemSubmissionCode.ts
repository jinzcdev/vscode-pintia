// submit:  https://pintia.cn/api/submissions/{submissionID}
// test:    https://pintia.cn/api/submissions/{submissionID}?custom_test_data_submission=true

export interface IProblemCode {
    details: IProblemSubmissionDetail[];
    problemType: string; // PROGRAMMING, CODE_COMPLETION, MULTIPLE_FILE
}

export interface IProblemSubmissionDetail {
    problemSetProblemId: string;
    codeCompletionSubmissionDetail?: ICodeCompletionAndProgrammingSubmissionDetail;
    programmingSubmissionDetail?: ICodeCompletionAndProgrammingSubmissionDetail;
    multipleFileSubmissionDetail?: IMultipleFileSubmissionDetail;
    customTestData?: {
        hasCustomTestData: boolean;
        content: string;
    }
    problemId: string;
}

interface ICodeCompletionAndProgrammingSubmissionDetail {
    compiler: string;
    program: string;
}

interface IMultipleFileSubmissionDetail {
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
    answerZip: string;
    withLocalhostNetwork: boolean;
    fileContents: {
        [key: string]: string;
    };
}
