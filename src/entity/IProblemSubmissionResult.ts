import { IProblemSubmissionDetail } from "./problemSubmissionCode";

export interface IProblemSubmissionResult {
    queued: number;
    submission: {
        id: string;
        user: {
            studentUser: {
                studentNumber: string;
                name: string;
                id: string;
            }
        };
        problemType: string;
        problemSetProblem: {
            id: string;
            label: string;
            type: string; // PROGRAMMING or CODE_COMPLETION
            problemPoolIndex: number;
            indexInProblemPool: number;
        };
        submitAt: string;
        status: string;
        score: number;
        compiler: string;
        time: number;
        memory: number;
        submissionDetails: IProblemSubmissionDetail[];
        judgeResponseContents: [{
            status: string;
            score: number;
            // "codeCompletionJudgeResponseContent" or "programmingJudgeResponseContent"
            codeCompletionJudgeResponseContent?: JudgeResponseContent;
            programmingJudgeResponseContent?: JudgeResponseContent;
            multipleFileJudgeResponseContent?: MultipleFileJudgeResponseContent;
            problemSetProblemId: string;
        }];
        hints: any;
        // {
        //     0: "sample 满3位没有0",
        // };
        problemSetId: string;
        previewSubmission: boolean;
        cause: string;
    };
    error?: {
        code: string;
        message: string;
    }
}

interface JudgeResponseContent {
    compilationResult: {
        log: string;
        success: boolean;
        error: string;
    },
    checkerCompilationResult: {
        log: string;
        success: boolean;
        error: string;
    },
    testcaseJudgeResults: any;
    /*
    {
    "0": {
        "result": "ACCEPTED",
        "exceed": "UNKNOWN_TESTCASE_EXCEED",
        "time": 0.004,
        "memory": 466944,
        "exitcode": 0,
        "termsig": 0,
        "error": "",
        "stdout": "",
        "stderr": "",
        "checkerOutput": "",
        "testcaseScore": 12,
        "stdoutTruncated": false,
        "stderrTruncated": false
    };
    */
}

interface MultipleFileJudgeResponseContent {
    stderr: string;
    stdout: string;
    info: string;
}