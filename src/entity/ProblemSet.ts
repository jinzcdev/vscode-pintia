
export interface ProblemSet {

    id: string;
    name: string;
    status: string;
    multiType: boolean;
    problemSetConfig: {
        compilers: string[]
    };

}
