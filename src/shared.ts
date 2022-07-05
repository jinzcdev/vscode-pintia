import { IProblemSummary } from "./entity/ProblemSummary";

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { IProblemInfo } from "./entity/ProblemInfo";

export const configPath = path.join(os.homedir(), ".pintia")

export enum UserStatus {
    SignedIn = 1,
    SignedOut = 2
}

export enum PtaLoginMethod {
    PTA = "PTA",
    WeChat = "WeChat"
}

export interface IQuickPickItem<T> extends vscode.QuickPickItem {
    value: T;
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
    ProblemSubSet = 2,
    ProblemPage = 3,
    Problem = 4
}

export interface IPtaNode {
    pID: string;
    psID: string;
    label: string;
    type: PtaNodeType;
    value: IPtaNodeValue;
    isFavorite: boolean;
    state: ProblemState;
    tag: string[];
}

export interface IPtaNodeValue {
    summaries: IProblemSummary;
    total: number;
    page: number;
    limit: number;
    problemTotal: number;
    problemType: ProblemType;
    problemInfo?: IProblemInfo;
}

export const defaultPtaNode: IPtaNode = {
    pID: "",
    psID: "",
    label: "",
    type: PtaNodeType.ProblemSet,
    value: {
        summaries: {
            PROGRAMMING: {
                total: 0,
                totalScore: 0
            },
            CODE_COMPLETION: {
                total: 0,
                totalScore: 0
            },
            numType: 1
        },
        total: 0,
        page: 0,
        limit: 0,
        problemTotal: 0,
        problemType: ProblemType.PROGRAMMING,
        problemInfo: undefined
    },
    isFavorite: false,
    state: ProblemState.Unknown,
    tag: [] as string[]
};

