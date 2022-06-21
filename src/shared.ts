
export enum UserStatus {
    SignedIn = 1,
    SignedOut = 2
}

export enum ProblemState {
    AC = 1,
    NotAC = 2,
    Unknown = 3,
}

export enum ProblemType {
    PROGRAMMING = "PROGRAMMING",
    CODE_COMPLETION = "CODE_COMPLETION"
}

export enum PtaNodeType {
    ProblemSet = 1,
    ProblemType = 2,
    Problem = 3
}

export interface IPtaNode {
    pID: string;
    psID: string;
    label: string;
    type: PtaNodeType;
    value: string;
}

export const defaultPtaNode: IPtaNode = {
    pID: "",
    psID: "",
    label: "",
    type: PtaNodeType.ProblemSet,
    value: ""
};
