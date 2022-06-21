import { Disposable } from "vscode";
import { PtaNode } from "./PtaNode";
import { ptaApi } from "../api";
import { ProblemType, PtaNodeType } from "../shared";
import { defaultPtaNode } from "../shared";

class ExplorerNodeManager implements Disposable {

    public async getRootNodes(): Promise<PtaNode[]> {
        const ptaNodeList: PtaNode[] = [];
        const problemSetList = await ptaApi.getAllProblemSets();
        problemSetList.forEach(pbs => {
            ptaNodeList.push(
                new PtaNode(Object.assign({}, defaultPtaNode, {
                    psID: pbs.id,
                    label: pbs.name,
                    type: PtaNodeType.ProblemSet,
                    value: pbs.multiType ? "multiType" : ""
                }))
            );
        });
        return ptaNodeList;
    }

    public async getProblemNodes(psID: number | string, problemType: ProblemType): Promise<PtaNode[]> {

        const ptaNodeList: PtaNode[] = [];
        const problemList = await ptaApi.getProblemList(psID, problemType);
        for (let i = 0; i < problemList.length; i++) {
            const pb = problemList[i];
            ptaNodeList.push(
                new PtaNode(Object.assign({}, defaultPtaNode, {
                    pID: pb.id,
                    psID: psID,
                    label: `[${i + 1}] ${pb.label} ${pb.title}`,
                    type: PtaNodeType.Problem,
                }))
            );
        }
        return ptaNodeList;
    }


    dispose() {
        throw new Error("Method not implemented.");
    }

}

export const explorerNodeManager: ExplorerNodeManager = new ExplorerNodeManager();
