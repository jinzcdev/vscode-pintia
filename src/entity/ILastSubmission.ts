
export interface ILastSubmission {
    id: string,
    user: {
        user: {
            id: string,
            nickname: string
        },
        studentUser: {
            studentNumber: string,
            name: string,
            id: string
        }
    },
    problemType: string,
    problemSetProblem: {
        id: string,
        label: string,
        type: string,
        problemPoolIndex: number,
        indexInProblemPool: number
    },
    submitAt: string,
    status: string,
    score: number,
    compiler: string,
    time: number,
    memory: number,
    submissionDetails: [
        {
            problemSetProblemId: string,
            programmingSubmissionDetail?: {
                compiler: string,
                program: string
            },
            codeCompletionSubmissionDetail?: {
                compiler: string,
                program: string
            },
            problemId: string
        }
    ],
    judgeResponseContents: [
        {
            status: string,
            score: number,
            programmingJudgeResponseContent: {
                compilationResult: {
                    log: string,
                    success: true,
                    error: string
                },
                checkerCompilationResult: {
                    log: string,
                    success: false,
                    error: string
                },
                testcaseJudgeResults: {}
            },
            problemSetProblemId: string
        }
    ],
    hints: {},
    problemSetId: string,
    previewSubmission: false,
    cause: string,
    judgeAt: string
}