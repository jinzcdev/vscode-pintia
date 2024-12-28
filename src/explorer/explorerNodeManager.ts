import * as vscode from "vscode";
import { Disposable, l10n } from "vscode";
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
import { defaultPtaNode, IPtaNodeValue, ProblemPermissionEnum, ProblemSetExamStatus, ProblemSubmissionState, ProblemType, problemTypeInfoMapping, PtaDashType, PtaNodeType, supportedProblemTypes, UNKNOWN } from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel, showYesOrNoPick } from "../utils/uiUtils";
import { PtaNode } from "./PtaNode";
import { IProblemSetExam } from "../entity/IProblemSetExam";

class ExplorerNodeManager implements Disposable {

    public async getRootNodes(): Promise<PtaNode[]> {
        const sections: IDashSection[] = await ptaApi.getDashSections();
        const ptaNodeList: PtaNode[] = [];
        const publicProblemSetList: IProblemSet[] = await ptaApi.getAlwaysAvailableProblemSets(ptaManager.getUserSession()?.cookie);
        const myProblemSetList: IProblemSet[] = await ptaApi.getMyProblemSets(ptaManager.getUserSession()?.cookie ?? "");
        const showLocked: boolean = ptaConfig.getShowLocked();

        const pbs2dash = new Map<string, string>();
        const dashes = new Map<string, Array<any>>();
        for (const section of sections) {
            section.displayConfigs.forEach(e => pbs2dash.set(e.problemSetId, section.title));
            dashes.set(section.title, []);
        }
        dashes.set(PtaDashType.Others, []);
        for (const item of publicProblemSetList) {
            if ((item.permission?.permission ?? ProblemPermissionEnum.UNKNOWN) === ProblemPermissionEnum.LOCKED && !showLocked) {
                continue;
            }
            dashes.get(pbs2dash.get(item.id) ?? PtaDashType.Others)?.push(item);
        }
        dashes.set(PtaDashType.MyProblemSet, myProblemSetList);
        for (const [sectionTitle, pbsList] of dashes) {
            if (pbsList.length === 0) {
                continue;
            }
            ptaNodeList.push(new PtaNode(Object.assign({}, defaultPtaNode, {
                label: `${sectionTitle}`,
                type: PtaNodeType.Dashboard
            })));
            pbsList.forEach(item => {
                ptaNodeList.push(
                    new PtaNode(Object.assign({}, defaultPtaNode, {
                        psID: item.id,
                        label: item.name,
                        type: PtaNodeType.ProblemSet,
                        locked: (item.permission?.permission ?? ProblemPermissionEnum.UNKNOWN) === ProblemPermissionEnum.LOCKED,
                        value: {
                            problemSet: item.name,
                            summaries: item.summaries
                        },
                        isMyProblemSet: sectionTitle === PtaDashType.MyProblemSet
                    }))
                );
            });
        }
        return ptaNodeList;
    }


    public async getSubProblemSet(node: PtaNode): Promise<PtaNode[]> {
        // container two kinds of problems (CODE_COMPLETION, PROGRAMMING)
        const value: IPtaNodeValue = node.value;
        const summaries: IProblemSummary = value.summaries;
        const nodeList: PtaNode[] = [];
        for (const problemType in summaries) {
            if (Object.prototype.hasOwnProperty.call(summaries, problemType)) {
                if (!supportedProblemTypes.has(problemType)) {
                    continue;
                }
                nodeList.push(new PtaNode(Object.assign({}, defaultPtaNode, {
                    psID: node.psID,
                    type: PtaNodeType.ProblemSubSet,
                    label: problemTypeInfoMapping.get(problemType)?.name ?? UNKNOWN,
                    value: Object.assign({}, value, {
                        problemType: problemType as ProblemType,
                    })
                })));
            }
        }
        return nodeList;
    }

    public async getProblemNodes(element: PtaNode, page?: number, limit?: number): Promise<PtaNode[]> {
        try {
            const [psID, psName, problemType] = [element.psID, element.value.problemSet, element.value.problemType as ProblemType];
            const userSession: IUserSession | undefined = ptaManager.getUserSession();
            if (!userSession) {
                return [];
            }

            if (element.isMyProblemSet) {
                const exams: IProblemSetExam = await ptaApi.getProblemSetExam(psID, userSession.cookie);
                if (exams && !exams.exam && exams.status === ProblemSetExamStatus.READY) {
                    // 私有题目集不应自动创建 exam, 询问用户是否创建
                    await showYesOrNoPick(l10n.t("The exam is not started yet. Do you want to start the exam now?")).then(created => {
                        created && vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: l10n.t("Creating exam for {0}...", psName),
                            cancellable: false
                        }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
                            ptaApi.createProblemSetExam(psID);
                        });
                    });
                }
            }
            await ptaApi.checkAndCreateProblemSetExam(psID, userSession.cookie);
            let problemList: IProblemInfo[], startIndex = 1;
            if (page !== undefined && limit !== undefined) {
                problemList = await ptaApi.getProblemInfoListByPage(psID, problemType, page, limit);
                startIndex = page * limit + 1;
            } else {
                problemList = await ptaApi.getAllProblemInfoList(psID, problemType);
            }

            let examProblemStatus: IExamProblemStatus[] | undefined;
            let problemExamMapping: Map<string, ProblemSubmissionState> = new Map();

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: l10n.t("Fetching user's exams for {0}...", psName),
                cancellable: false
            }, async (p: vscode.Progress<{ message?: string; increment?: number }>) => {
                return new Promise<void>(async (resolve: () => void, reject: (e: Error) => void): Promise<void> => {

                    ptaChannel.appendLine("[INFO] Refetching user's exams");
                    examProblemStatus = await ptaApi.getExamProblemStatus(psID, userSession.cookie);
                    if (examProblemStatus) {
                        for (const e of examProblemStatus!) {
                            problemExamMapping.set(e.id, e.problemSubmissionStatus as ProblemSubmissionState);
                        }
                        resolve();
                    } else {
                        reject(Error(`The examStatus is undefined. ProblemSetID is ${psID}`));
                    }
                });
            });

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
                        isFavorite: favoriteProblemsManager.isFavoriteProblem(favoriteProblemsManager.getCurrentUserId(), pb.id),
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
            promptForOpenOutputChannel(l10n.t("Failed to fetch the problem list. Please open the output channel for details."), DialogType.error);
            return [];
        }
    }


    public async getProblemSetPageNodes(element: PtaNode, total: number, limit?: number): Promise<PtaNode[]> {
        if (limit === undefined) {
            limit = 100;
        }
        const [psID, psName, problemType] = [element.psID, element.value.problemSet, element.value.problemType as ProblemType];

        const nodeList: PtaNode[] = [];
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
    }

}

export const explorerNodeManager: ExplorerNodeManager = new ExplorerNodeManager();
