
import * as vscode from "vscode";
import * as path from "path";
import { PtaNode } from "./PtaNode";
import { defaultPtaNode, IPtaNodeValue, ProblemSubmissionState, ProblemType, PtaNodeType } from "../shared";
import { ptaManager } from "../PtaManager";
import { explorerNodeManager } from "./explorerNodeManager";
import { ptaConfig } from "../ptaConfig";
import { IProblemSummary } from "../entity/IProblemSummary";


export class PtaTreeDataProvider implements vscode.TreeDataProvider<PtaNode>, vscode.Disposable {

    private context: vscode.ExtensionContext | undefined;
    private configurationChangeListener: vscode.Disposable;

    private onDidChangeTreeDataEvent: vscode.EventEmitter<PtaNode | undefined | null> = new vscode.EventEmitter<PtaNode | undefined | null>();
    // tslint:disable-next-line:member-ordering
    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;


    public constructor() {
        this.configurationChangeListener = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("pintia.paging.pageSize") || event.affectsConfiguration("pintia.showLocked")) {
                this.onDidChangeTreeDataEvent.fire(null);
            }
        }, this);
    }

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
        if (element.type === PtaNodeType.Dashboard) {
            return {
                label: element.label,
                collapsibleState: vscode.TreeItemCollapsibleState.None
            }
        }
        return {
            label: element.type === PtaNodeType.Problem ? `${element.label} (${element.score})` : element.label,
            collapsibleState: element.type === PtaNodeType.Problem ?
                vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: this.parseIconPathFromProblemState(element),
            command: element.type === PtaNodeType.Problem ? {
                title: "Preview Problem",
                command: "pintia.previewProblem",
                arguments: [element]
            } : undefined
        };
    }
    getChildren(element?: PtaNode): vscode.ProviderResult<PtaNode[]> {
        const limit: number = ptaConfig.getPageSize();
        const paged: boolean = limit !== 0;

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
            // return explorerNodeManager.getProblemSetNodes(1);
        }
        // if (element.type === PtaNodeType.Dashboard) {
        //     return explorerNodeManager.getProblemSetNodes(element.dashID);
        // }

        const value: IPtaNodeValue = element.value;
        if (element.type === PtaNodeType.ProblemSet) {
            if (Object.keys(value.summaries).length > 1) {
                return explorerNodeManager.getSubProblemSet(element);
            }
            const problemType: string = Object.keys(value.summaries)[0];
            const total: number = value.summaries[problemType as keyof IProblemSummary]?.total ?? 0;

            if (!paged || total < limit) {
                // 1-200, 201-400
                return explorerNodeManager.getProblemNodes(element.psID, element.value.problemSet, problemType as ProblemType);
            } else {
                return explorerNodeManager.getProblemSetPageNodes(element.psID, element.value.problemSet, problemType as ProblemType, total, limit);
            }
        }

        if (element.type === PtaNodeType.ProblemSubSet) {
            const total: number = value.summaries[value.problemType]?.total ?? 0;
            // node.type === PtaNodeType.ProblemType
            if (!paged || total < limit) {
                return explorerNodeManager.getProblemNodes(element.psID, element.value.problemSet, value.problemType);
            } else {
                return explorerNodeManager.getProblemSetPageNodes(element.psID, element.value.problemSet, value.problemType, total, limit);
            }
        }

        if (element.type === PtaNodeType.ProblemPage) {
            return explorerNodeManager.getProblemNodes(element.psID, element.value.problemSet, value.problemType, value.page, limit);
        }

        return null;

    }

    private parseIconPathFromProblemState(element: PtaNode): string {
        if (!this.context) {
            return "";
        }
        if (element.type === PtaNodeType.ProblemSet && element.locked) {
            return this.context.asAbsolutePath(path.join("resources", "lock.png"));
        }
        if (element.type !== PtaNodeType.Problem) {
            return "";
        }
        switch (element.state) {
            case ProblemSubmissionState.PROBLEM_ACCEPTED:
                return this.context.asAbsolutePath(path.join("resources", "check.png"));
            case ProblemSubmissionState.PROBLEM_WRONG_ANSWER:
                return this.context.asAbsolutePath(path.join("resources", "x.png"));
            case ProblemSubmissionState.PROBLEM_NO_ANSWER:
                return this.context.asAbsolutePath(path.join("resources", "blank.png"));
            default:
                return "";
        }
    }

    public refresh() {
        this.onDidChangeTreeDataEvent.fire(null);
    }

    public dispose() {
        this.configurationChangeListener.dispose();
    }

}


export const ptaTreeDataProvider: PtaTreeDataProvider = new PtaTreeDataProvider();