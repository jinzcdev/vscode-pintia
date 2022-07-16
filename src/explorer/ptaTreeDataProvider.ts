
import * as vscode from "vscode";
import { PtaNode } from "./PtaNode";
import { defaultPtaNode, IPtaNodeValue, ProblemType, PtaNodeType } from "../shared";
import { ptaManager } from "../PtaManager";
import { explorerNodeManager } from "./explorerNodeManager";


export class PtaTreeDataProvider implements vscode.TreeDataProvider<PtaNode> {

    private context: vscode.ExtensionContext | undefined;
    private isPaged: boolean = true;


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
                    command: "pintia.signIn"
                }
            };
        }
        return {
            label: element.label,
            collapsibleState: element.type === PtaNodeType.Problem ?
                vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
            command: element.type === PtaNodeType.Problem ? {
                title: "Preview Problem",
                command: "pintia.previewProblem",
                arguments: [element]
            } : undefined
        };
    }
    getChildren(element?: PtaNode): vscode.ProviderResult<PtaNode[]> {
        const limit = 200;
        if (!ptaManager.getUserSession()) {
            return [
                new PtaNode(Object.assign({}, defaultPtaNode, {
                    pID: "notSignIn",
                    label: "Sign in to Pintia"
                }))
            ];
        }
        if (!element) {
            // root directoty
            return explorerNodeManager.getRootNodes();
        }
        const value: IPtaNodeValue = element.value;
        if (element.type === PtaNodeType.ProblemSet) {
            if (value.summaries.numType > 1) {
                // container two kinds of problems (CODE_COMPLETION, PROGRAMMING)
                return [
                    new PtaNode(Object.assign({}, defaultPtaNode, {
                        psID: element.psID,
                        type: PtaNodeType.ProblemSubSet,
                        label: "函数题",
                        value: Object.assign({}, value, {
                            problemType: ProblemType.CODE_COMPLETION,
                        })
                    })),
                    new PtaNode(Object.assign({}, defaultPtaNode, {
                        psID: element.psID,
                        type: PtaNodeType.ProblemSubSet,
                        label: "编程题",
                        value: Object.assign({}, value, {
                            problemType: ProblemType.PROGRAMMING
                        })
                    })),
                ];
            }
            const total: number = value.summaries[ProblemType.PROGRAMMING].total;
            // only "PROGRAMMING", return problem list
            if (!this.isPaged || total < limit) {
                // 1-200, 201-400
                return explorerNodeManager.getProblemNodes(element.psID, ProblemType.PROGRAMMING);
            } else {
                return explorerNodeManager.getProblemSetPageNodes(element.psID, ProblemType.PROGRAMMING, total, limit);
            }
        }

        if (element.type === PtaNodeType.ProblemSubSet) {
            const total: number = value.summaries[value.problemType].total;
            // node.type === PtaNodeType.ProblemType
            if (!this.isPaged || total < limit) {
                return explorerNodeManager.getProblemNodes(element.psID, value.problemType);
            } else {
                return explorerNodeManager.getProblemSetPageNodes(element.psID, value.problemType, total, limit);
            }
        }

        if (element.type === PtaNodeType.ProblemPage) {
            // return explorerNodeManager.getProblemNodes(element.psID, )
            return explorerNodeManager.getProblemNodes(element.psID, value.problemType, value.page, limit);
        }

        return null;

    }

    public refresh() {
        this.onDidChangeTreeDataEvent.fire(null);
    }
}


export const pintiaTreeDataProvider: PtaTreeDataProvider = new PtaTreeDataProvider();