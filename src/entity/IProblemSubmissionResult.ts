import { IProblem } from "./IProblem";
import { IProblemSubmissionDetail } from "./problemSubmissionCode";

export interface IProblemSubmissionResult {
    publicCases: {
        [key: string]: boolean;
    };
    queued: number;
    submission: ISubmission;
    examMember: IExamMember;
    // extra
    problem?: IProblem;
}

interface ICompilationResult {
    log: string;
    success: boolean;
    error: string;
}

interface ICodeCompletionAndProgrammingJudgeResponseContent {
    compilationResult: ICompilationResult;
    checkerCompilationResult: ICompilationResult;
    testcaseJudgeResults: {
        [key: string]: {
            result: string;
            exceed: string;
            time: number;
            memory: number;
            exitcode: number;
            termsig: number;
            error: string;
            stdout: string;
            stderr: string;
            checkerOutput: string;
            testcaseScore: number;
            stdoutTruncated: boolean;
            stderrTruncated: boolean;
            showOutput: boolean;
        };
    };
}

interface IJudgeResponseContent {
    status: string;
    score: number;
    codeCompletionJudgeResponseContent?: ICodeCompletionAndProgrammingJudgeResponseContent;
    programmingJudgeResponseContent?: ICodeCompletionAndProgrammingJudgeResponseContent;
    multipleFileJudgeResponseContent?: {
        stderr: string;
        stdout: string;
        info: string;
    };
    problemSetProblemId: string;
}

interface ISubmission {
    id: string;
    userId: string;
    problemType: string;
    problemSetProblemId: string;
    submitAt: string;
    status: string;
    score: number;
    compiler: string;
    time: number;
    memory: number;
    submissionDetails: IProblemSubmissionDetail[];
    judgeResponseContents: IJudgeResponseContent[];
    hints: {
        [key: string]: string;
    };
    problemSetId: string;
    previewSubmission: boolean;
    cause: string;
    judgeAt: string;
}

interface IExamMember {
    user: {
        id: string;
        nickname: string;
    };
    studentUser: {
        studentNumber: string;
        name: string;
        id: string;
    };
    userGroupId: string;
    examId: string;
}