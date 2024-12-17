
import { IPtaNode, IPtaNodeValue, ProblemSubmissionState, PtaNodeType } from "../shared";

export class PtaNode {

    constructor(private data: IPtaNode) { }

    public get dashID(): number {
        return this.data.dashID;
    }

    public get pID(): string {
        return this.data.pID;
    }

    public get psID(): string {
        return this.data.psID;
    }

    public get title(): string {
        return this.data.title;
    }

    public get label(): string {
        return this.data.label;
    }

    public get type(): PtaNodeType {
        return this.data.type;
    }

    public get state(): ProblemSubmissionState {
        return this.data.state;
    }

    public get score(): number {
        return this.data.score;
    }

    public get locked(): boolean {
        return this.data.locked;
    }

    public get value(): IPtaNodeValue {
        return this.data.value;
    }

    public get isFavorite(): boolean {
        return this.data.isFavorite;
    }

    public get isMyProblemSet(): boolean {
        return this.data.isMyProblemSet;
    }

}