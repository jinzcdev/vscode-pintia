import * as vscode from "vscode";
import { Disposable } from "vscode";
import { IDashSection } from "../entity/IDashSection";
import { IExamProblemStatus } from "../entity/IExamProblemStatus";
import { IProblemInfo } from "../entity/IProblemInfo";
import { IProblemSet } from "../entity/IProblemSet";
import { IProblemSummary } from "../entity/IProblemSummary";
import { IUserSession } from "../entity/userLoginSession";
import { favoriteProblemsManager } from "../favorites/favoriteProblemsManager";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { ptaManager } from "../ptaManager";
import { defaultPtaNode, IPtaNodeValue, ProblemSubmissionState, ProblemType, problemTypeNameMapping, PtaNodeType } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";
import { PtaNode } from "./PtaNode";

class ExplorerNodeManager implements Disposable {

    public async getRootNodes(): Promise<PtaNode[]> {
        const sections: IDashSection[] = await ptaApi.getDashSections();
        const ptaNodeList: PtaNode[] = [];
        const problemSetList: IProblemSet[] = await ptaApi.getAllProblemSets(ptaManager.getUserSession()?.cookie);
        const showLocked: boolean = ptaConfig.getShowLocked();
        const OTHER_SECTION: string = "Others";

        const pbs2dash = new Map<string, string>();
        const dashes = new Map<string, Array<any>>([[OTHER_SECTION, []]]);
        for (const section of sections) {
            section.displayConfigs.forEach(e => pbs2dash.set(e.problemSetId, section.title));
            dashes.set(section.title, []);
        }
        for (const item of problemSetList) {
            if ((item.permission?.permission ?? 0) === 9 && !showLocked) {
                continue;
            }
            dashes.get(pbs2dash.get(item.id) ?? OTHER_SECTION)?.push(item);
        }
        for (const [sectionTitle, pbsList] of dashes) {
            if (pbsList.length === 0) {
                continue;
            }
            ptaNodeList.push(new PtaNode(Object.assign({}, defaultPtaNode, {
                label: `—— ${sectionTitle} ——`,
                type: PtaNodeType.Dashboard,
            })));
            pbsList.forEach(item => {
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
            });
        }
        return ptaNodeList;
    }

    public async getSubProblemSet(node: PtaNode): Promise<PtaNode[]> {
        // container two kinds of problems (CODE_COMPLETION, PROGRAMMING, MULTIPLE_FILE)
        const value: IPtaNodeValue = node.value;
        const summaries: IProblemSummary = value.summaries;
        const nodeList: PtaNode[] = [];
        for (const problemType in summaries) {
            if (Object.prototype.hasOwnProperty.call(summaries, problemType)) {
                nodeList.push(new PtaNode(Object.assign({}, defaultPtaNode, {
                    psID: node.psID,
                    type: PtaNodeType.ProblemSubSet,
                    label: problemTypeNameMapping.get(problemType) ?? "ERROR",
                    value: Object.assign({}, value, {
                        problemType: problemType as ProblemType,
                    })
                })));
            }
        }
        return nodeList;
    }

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
                    title: `Fetching user's exams for ${psName}...`,
                    cancellable: false
                }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
                    return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {

                        ptaChannel.appendLine("[INFO] Refetching user's exams");
                        examStatus = await ptaApi.getExamProblemStatus(psID, userSession.cookie);
                        if (examStatus) {
                            for (const e of examStatus!) {
                                problemExamMapping.set(e.id, e.problemSubmissionStatus as ProblemSubmissionState);
                            }
                            resolve();
                        } else {
                            reject(Error("examStatus is undefined"));
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
                        title: `${pb.label} ${pb.title}`,
                        label: `[${i + startIndex}] ${pb.label} ${pb.title}`,
                        type: PtaNodeType.Problem,
                        score: pb.score,
                        state: problemExamMapping.get(pb.id) ?? ProblemSubmissionState.PROBLEM_NO_ANSWER,
                        isFavorite: favoriteProblemsManager.isProblemFavorite(favoriteProblemsManager.getCurrentUserId(), pb.id),
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
                label: `${i * limit + 1}-${i === pageNum - 1 ? total : (i + 1) * limit}`,
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
