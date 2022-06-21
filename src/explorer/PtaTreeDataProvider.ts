
import * as vscode from "vscode";
import { PtaNode } from "./PtaNode";
import { defaultPtaNode, IPtaNode, ProblemType, PtaNodeType } from "../shared";
import { ptaManager } from "../PtaManager";
import { explorerNodeManager } from "./explorerNodeManager";


export class PtaTreeDataProvider implements vscode.TreeDataProvider<PtaNode> {

    private context: vscode.ExtensionContext | undefined;


    private onDidChangeTreeDataEvent: vscode.EventEmitter<PtaNode | undefined | null> = new vscode.EventEmitter<PtaNode | undefined | null>();
    // tslint:disable-next-line:member-ordering
    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
    }


    getTreeItem(element: PtaNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (element.pID === "notSignIn") {
            return {
                label: element.label,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                command: {
                    title: "Sign in to Pintia",
                    command: "pintia.signin"
                }
            };
        }
        return {
            label: element.label,
            collapsibleState: element.type === PtaNodeType.Problem ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
            tooltip: "hshshhshs",
            command: element.type === PtaNodeType.Problem ? {
                title: "Sign in to Pintia",
                command: "pintia.previewProblem",
                arguments: [element]
            } : undefined
        };
    }
    getChildren(element?: PtaNode): vscode.ProviderResult<PtaNode[]> {
        if (!ptaManager.getUser()) {
            return [
                new PtaNode({
                    pID: "notSignIn",
                    psID: "notSignIn",
                    label: "Sign in to Pintia",
                    type: PtaNodeType.Problem,
                    value: ""
                })
            ];
        }
        if (!element) {
            // root directoty
            return explorerNodeManager.getRootNodes();
        } else if (element.type === PtaNodeType.ProblemSet) {
            if (element.value === "multiType") {
                // container two kinds of problems (CODE_COMPLETION, PROGRAMMING)
                return [
                    new PtaNode(Object.assign({}, defaultPtaNode, {
                        psID: element.psID,
                        type: PtaNodeType.ProblemType,
                        label: "函数题",
                        value: ProblemType.CODE_COMPLETION
                    })),
                    new PtaNode(Object.assign({}, defaultPtaNode, {
                        psID: element.psID,
                        type: PtaNodeType.ProblemType,
                        label: "编程题",
                        value: ProblemType.PROGRAMMING
                    })),
                ];
            } else {
                // only "PROGRAMMING", return problem list
                return explorerNodeManager.getProblemNodes(element.psID, ProblemType.PROGRAMMING);
            }
        } else if (element.type === PtaNodeType.ProblemType) {
            // node.type === PtaNodeType.ProblemType
            const problemType: ProblemType = element.value === "PROGRAMMING"
                ? ProblemType.PROGRAMMING : ProblemType.CODE_COMPLETION;
            return explorerNodeManager.getProblemNodes(element.psID, problemType);
        } else {
            return null;
        }
    }

    public refresh() {
        this.onDidChangeTreeDataEvent.fire(null);
    }
}


export const pintiaTreeDataProvider: PtaTreeDataProvider = new PtaTreeDataProvider();