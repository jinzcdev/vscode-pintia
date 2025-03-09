// https://pintia.cn/api/problem-sets/${problemSetID}/problems/{problemID}
export interface IProblem {
    id: string;
    label: string;
    score: number;
    problemConfig: {
        programmingProblemConfig?: IProblemConfig;
        codeCompletionProblemConfig?: IProblemConfig;
        multipleFileProblemConfig?: IProblemConfig;
        solutionVisible: boolean;
        answerVisible: boolean;
    };
    deadline: string;
    title: string;
    content: string;
    type: string;
    author: string;
    difficulty: number,
    compiler: string;   // compiler to be allowed to use in this problem.
    problemStatus: string;
    lastSubmissionId: string;
    solution: string;
    problemSetId: string;
    problemId: string;
    description: string;
    problemPoolIndex: number;
    indexInProblemPool: number;

    // put `organization` in `problem`
    authorOrganizationId: string;
    organization: Organization;

    // put `submissionDetail` in `problem`
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

export interface IProblemConfig extends ICodeCompletionAndProgrammingProblemConfig, IMultipleFileProblemConfig {
    timeLimit: number;
    memoryLimit: number;
    cases: {
        [key: string]: {
            hint: string;
            showHint: boolean;
            score: number;
            isPublic: boolean;
        };
    };
    tools: string[];
}


/**
 * programmingProblemConfig
 * codeCompletionProblemConfig
 */
interface ICodeCompletionAndProgrammingProblemConfig {
    codeSizeLimit: number;
    exampleTestDatas: [{
        name: string;
        input: string;
        output: string;
    }];
    testdataDescriptionCode: string;
    customizeLimits: [ICustomizeLimit];
    stackSizeLimit: number;
    ignorePresentationError: boolean;
}

interface ICustomizeLimit {
    compiler: string;
    codeSizeLimit: number;
    timeLimit: number;
    memoryLimit: number;
    stackSizeLimit: number;
}

/**
 * multipleFileProblemConfig
 */
interface IMultipleFileProblemConfig {
    cpuCount: number;
    template: string;
    files: [{
        path: string;
        directory: boolean;
    }];
    judgeZip: string,
    originalScore: 100,
    compiles: string[];
    withLocalhostNetwork: boolean;
    fileContents: {
        [key: string]: string;
    };
}

interface Organization {
    id: string;
    name: string;
    code: string;
    type: string;
    logo: string;
}