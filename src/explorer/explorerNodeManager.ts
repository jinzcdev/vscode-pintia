import * as vscode from "vscode";
import { Disposable } from "vscode";
import { IDashSection } from "../entity/IDashSection";
import { IExamProblemStatus } from "../entity/IExamProblemStatus";
import { IProblemInfo } from "../entity/ProblemInfo";
import { IProblemSet } from "../entity/ProblemSet";
import { IUserSession } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { ptaManager } from "../PtaManager";
import { defaultPtaNode, ProblemSubmissionState, ProblemType, PtaNodeType } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaNode } from "./PtaNode";

class ExplorerNodeManager implements Disposable {

    public async getRootNodes(): Promise<PtaNode[]> {
        const sections: IDashSection[] = await ptaApi.getDashSections();
        const ptaNodeList: PtaNode[] = [];
        const problemSetList: IProblemSet[] = await ptaApi.getAllProblemSets(ptaManager.getUserSession()?.cookie);
        const showLocked: boolean = ptaConfig.getShowLocked();

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const displayConfigs = section.displayConfigs.map<string>((value, _) => value.problemSetId);
            ptaNodeList.push(new PtaNode(Object.assign({}, defaultPtaNode, {
                // label: `${i + 1}. ${section.title}`,
                label: `—— ${section.title} ——`,
                type: PtaNodeType.Dashboard,
            })));
            for (const item of problemSetList) {
                if ((item.permission?.permission ?? 0) === 9 && !showLocked) {
                    continue;
                }
                if (displayConfigs.indexOf(item.id) !== -1) {
                    ptaNodeList.push(
                        new PtaNode(Object.assign({}, defaultPtaNode, {
                            psID: item.id,
                            label: item.name,
                            type: PtaNodeType.ProblemSet,
                            locked: (item.permission?.permission ?? 0) === 9,
                            value: {
                                problemSet: item.name,
                                summaries: item.summaries
                            }
                        }))
                    );
                }
            }
        }
        return ptaNodeList;
    }

    /*
    public async getRootNodes(): Promise<PtaNode[]> {
        const sections: IDashSection[] = await ptaApi.getDashSections();
        const ptaNodeList: PtaNode[] = [];
        for (let i = 0; i < sections.length; i++) {
            ptaNodeList.push(
                new PtaNode(Object.assign({}, defaultPtaNode, {
                    dashID: i,
                    label: sections[i].title,
                    type: PtaNodeType.Dashboard
                }))
            );
        }
        return ptaNodeList;
    }
    */

    public async getProblemNodes(psID: string, psName: string, problemType: ProblemType, page?: number, limit?: number): Promise<PtaNode[]> {
        try {
            let problemList: IProblemInfo[], startIndex = 1;
            if (page !== undefined && limit !== undefined) {
                problemList = await ptaApi.getProblemInfoListByPage(psID, problemType, page, limit);
                startIndex = page * limit + 1;
            } else {
                problemList = await ptaApi.getAllProblemInfoList(psID, problemType);
            }

            const userSession: IUserSession | undefined = ptaManager.getUserSession();
            let examStatus: IExamProblemStatus[] | undefined;
            let problemExamMapping: Map<string, ProblemSubmissionState> = new Map();
            if (userSession) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Fetching user's exams...",
                    cancellable: false
                }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
                    return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {

                        ptaChannel.appendLine("[INFO] Refetch user's exams");
                        examStatus = await ptaApi.getExamProblemStatus(psID, userSession.cookie);
                        if (examStatus) {
                            for (const e of examStatus) {
                                problemExamMapping.set(e.id, e.problemSubmissionStatus as ProblemSubmissionState);
                            }
                            resolve();
                        }
                    });
                });
            }

            const ptaNodeList: PtaNode[] = [];
            for (let i = 0; i < problemList.length; i++) {
                const pb: IProblemInfo = problemList[i];
                ptaNodeList.push(
                    new PtaNode(Object.assign({}, defaultPtaNode, {
                        pID: pb.id,
                        psID: psID,
                        label: `[${i + startIndex}] ${pb.label} ${pb.title}`,
                        type: PtaNodeType.Problem,
                        score: pb.score,
                        state: problemExamMapping.get(pb.id) ?? ProblemSubmissionState.PROBLEM_NO_ANSWER,
                        value: {
                            problemType: problemType,
                            problemInfo: pb,
                            problemSet: psName
                        }
                    }))
                );
            }
            return ptaNodeList;
        } catch (error: any) {
            ptaChannel.appendLine(error.toString());
            promptForOpenOutputChannel("Failed to fetch the problem list. Please open the output channel for details.", DialogType.error);
            return [];
        }
    }


    public async getProblemSetPageNodes(psID: string, psName: string, problemType: ProblemType, total: number, limit?: number): Promise<PtaNode[]> {
        if (limit === undefined) {
            limit = 100;
        }

        // const summaries = ptaNode.value;
        let nodeList: PtaNode[] = [];
        // const total = summaries[ProblemType.PROGRAMMING]["total"];
        const pageNum: number = Math.ceil(total / limit);

        for (let i = 0; i < pageNum; i++) {
            nodeList.push(new PtaNode(Object.assign({}, defaultPtaNode, {
                psID: psID,
                type: PtaNodeType.ProblemPage,
                label: `${i * limit + 1}-${i == pageNum - 1 ? total : (i + 1) * limit}`,
                value: {
                    total: total,
                    limit: limit,
                    page: i,
                    problemType: problemType,
                    problemSet: psName
                }
            })));
        }
        return nodeList;
    }


    dispose() {
        throw new Error("Method not implemented.");
    }

}

export const explorerNodeManager: ExplorerNodeManager = new ExplorerNodeManager();
