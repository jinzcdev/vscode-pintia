// https://pintia.cn/api/problem-sets/${problemSetID}/problems/{problemID}
export interface IProblem {
    id: string;
    label: string;
    score: number;
    problemConfig: {
        programmingProblemConfig?: ProblemConfig;
        codeCompletionProblemConfig?: ProblemConfig;
        multipleFileProblemConfig?: MultipleFileProblemConfig;
        solutionVisible: boolean;
    };
    deadline: string;
    title: string;
    content: string;
    type: string;
    author: string;
    authorOrganization: {
        id: string;
        name: string;
        comment: string;
        code: string;
        country: string;
        membersCount: number;
        type: string;
        balance: number;
        subdomain: string;
        logo: string;
    };
    compiler: string;   // compiler to be allowed to use in this problem.
    problemStatus: string;
    lastSubmissionId: string;
    solution: string;
    problemSetId: string;
    problemId: string;
    description: string;
    problemPoolIndex: number;
    indexInProblemPool: number;

    lastSubmissionDetail?: {
        problemSetProblemId: string; // "0" denotes no submission.
        programmingSubmissionDetail?: {
            compiler: string;
            program: string;
        };
        codeCompletionSubmissionDetail?: {
            compiler: string;
            program: string;
        };
        multipleFileSubmissionDetail?: {
            answerZip: string;
            fileContents: any;
            files: any;
        }
        problemId: string;
    },
}



/**
 * programmingProblemConfig
 * codeCompletionProblemConfig
 */
interface ProblemConfig {
    timeLimit: number;
    memoryLimit: number;
    codeSizeLimit: number;
    cases: {};
    exampleTestDatas: [{
        name: string;
        input: string;
        output: string;
    }];
    testdataDescriptionCode: string;
    customizeLimits: [];
    stackSizeLimit: 0;
    tools: [];
}

/**
 * multipleFileProblemConfig
 */
interface MultipleFileProblemConfig {
    memoryLimit: number;
    cpuCount: number;
    template: string;
    files: [{
        path: string;
        directory: boolean;
    }];
    judgeZip: string,
    originalScore: 100,
    compiles: string[];
    tools: string[];
    withLocalhostNetwork: boolean;
    fileContents: {}
}