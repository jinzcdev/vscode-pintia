
export class ProblemSummary {

    id: string;
    name: string;
    status: string;
    compilers: string[];

    constructor(id: string, name: string, status: string, compilers: string[]) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.compilers = compilers;
    }

}
