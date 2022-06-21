
import { IPtaNode, PtaNodeType } from "../shared";

export class PtaNode {

    constructor(private data: IPtaNode) { }

    public get pID(): string {
        return this.data.pID;
    }

    public get psID(): string {
        return this.data.psID;
    }

    public get label(): string {
        return this.data.label;
    }

    public get type(): PtaNodeType {
        return this.data.type;
    }

    public get value(): string {
        return this.data.value;
    }

}