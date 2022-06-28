import { IProblemSubmissionDetail } from "./ProblemSubmissionCode";


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
            programmingJudgeResponseContent: {
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
                testcaseJudgeResults: {
                    /*
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
            };
            problemSetProblemId: string;
        }];
        hints: {};
        problemSetId: string;
        previewSubmission: boolean;
        cause: string;
    };
}