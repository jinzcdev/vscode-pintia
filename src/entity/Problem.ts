
export interface Problem {

    id: string;
    label: string;
    score: number;
    deadline: string;
    acceptCount: number;
    submitCount: number;
    title: string;
    type: string;
    compiler: string;
    problemStatus: string;
    problemSetId: string;
    problemPoolIndex: number;
    indexInProblemPool: number;

    // constructor(id: string, label: string, score: string, title: string, acceptCount: number,
    //     submitCount: number, type: string, compiler: string, problemSetId: string) {
    //     this.id = id;
    //     this.label = label;
    //     this.score = score;
    //     this.title = title;
    //     this.acceptCount = acceptCount;
    //     this.submitCount = submitCount;
    //     this.type = type;
    //     this.compiler = compiler;
    //     this.problemSetId = problemSetId;
    // }

}
