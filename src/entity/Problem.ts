
export interface IProblem {
    id: string;
    label: string;
    score: number;
    problemConfig: {
        programmingProblemConfig?: ProblemConfig;
        codeCompletionProblemConfig?: ProblemConfig;
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
    compiler: string;
    problemStatus: string;
    lastSubmissionId: string;
    solution: string;
    problemSetId: string;
    problemId: string;
    description: string;
    problemPoolIndex: number;
    indexInProblemPool: number;
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