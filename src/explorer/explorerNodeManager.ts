import { Disposable } from "vscode";
import { PtaNode } from "./PtaNode";
import { ptaApi } from "../utils/api";
import { ProblemType, PtaNodeType } from "../shared";
import { defaultPtaNode } from "../shared";
import { IProblemInfo } from "../entity/ProblemInfo";

class ExplorerNodeManager implements Disposable {

    public async getRootNodes(): Promise<PtaNode[]> {
        const ptaNodeList: PtaNode[] = [];
        const problemSetList = await ptaApi.getAllProblemSets();
        problemSetList.forEach(item => {
            ptaNodeList.push(
                new PtaNode(Object.assign({}, defaultPtaNode, {
                    psID: item.id,
                    label: item.name,
                    type: PtaNodeType.ProblemSet,
                    value: {
                        summaries: item.summaries,
                        limit: 50 // not used
                    }
                }))
            );
        });
        return ptaNodeList;
    }

    public async getProblemNodes(psID: string, problemType: ProblemType, page?: number, limit?: number): Promise<PtaNode[]> {
        let problemList: IProblemInfo[], startIndex = 1;
        if (page !== undefined && limit !== undefined) {
            problemList = await ptaApi.getProblemInfoListByPage(psID, problemType, page, limit);
            startIndex = page * limit + 1;
        } else {
            problemList = await ptaApi.getAllProblemInfoList(psID, problemType);
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
                    value: {
                        problemInfo: pb
                    }
                }))
            );
        }
        return ptaNodeList;
    }


    public async getProblemSetPageNodes(psID: string, problemType: ProblemType, total: number, limit?: number): Promise<PtaNode[]> {
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
                    problemType: problemType
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
