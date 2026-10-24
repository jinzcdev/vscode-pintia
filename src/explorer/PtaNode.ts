import { IPtaNode, IPtaNodeValue, ProblemSubmissionState, PtaNodeType } from "../shared";

export class PtaNode {
    constructor(private data: IPtaNode) {}

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

    /**
     * 就地更新节点数据，保持实例不变。
     *
     * 节点会进入 `ExplorerNodeManager` 的缓存；刷新题集列表时若直接替换实例，
     * 树模型与 `TreeView.reveal` 会拿到不同的对象，因此这里只合并字段。
     */
    public update(partial: Partial<IPtaNode>): void {
        this.data = {
            ...this.data,
            ...partial,
            value: { ...this.data.value, ...(partial.value ?? {}) },
        };
    }
}
