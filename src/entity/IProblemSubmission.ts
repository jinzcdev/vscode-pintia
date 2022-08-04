
export interface IProblemSubmission {
    submissionId: string;
    submissionType: string;
    problems: [];
    
    error: {
        code: string;
        message: string;
    };
}