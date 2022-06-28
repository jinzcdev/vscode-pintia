import { IProblemSummary } from "./ProblemSummary";

export interface IProblemSet {

    id: string;
    name: string;
    status: string;
    multiType: boolean;
    problemSetConfig: {
        compilers: string[]
    };
    summaries: IProblemSummary;
}
