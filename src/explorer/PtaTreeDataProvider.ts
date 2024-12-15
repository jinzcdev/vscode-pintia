
import * as vscode from "vscode";
import * as path from "path";
import { PtaNode } from "./PtaNode";
import { defaultPtaNode, IPtaNodeValue, ProblemSubmissionState, ProblemType, PtaDashType, PtaNodeType } from "../shared";
import { ptaManager } from "../ptaManager";
import { explorerNodeManager } from "./explorerNodeManager";
import { ptaConfig } from "../ptaConfig";
import { IProblemSummary } from "../entity/IProblemSummary";
import { ptaApi } from "../utils/api";


export class PtaTreeDataProvider implements vscode.TreeDataProvider<PtaNode>, vscode.Disposable {

    private context: vscode.ExtensionContext | undefined;
    private configurationChangeListener: vscode.Disposable;

    private onDidChangeTreeDataEvent: vscode.EventEmitter<PtaNode | undefined | null> = new vscode.EventEmitter<PtaNode | undefined | null>();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;


    public constructor(context: vscode.ExtensionContext) {
        this.configurationChangeListener = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("pintia.paging.pageSize") || event.affectsConfiguration("pintia.showLocked")) {
                this.onDidChangeTreeDataEvent.fire(null);
            }
        }, this);
        this.context = context;
    }

    getTreeItem(element: PtaNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (!element) {
            return {
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None
            };
        }
        if (element.type === PtaNodeType.Dashboard) {
            return {
                label: `— ${element.label} —`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: element.label === PtaDashType.MyProblemSet ? new vscode.ThemeIcon("smiley") : new vscode.ThemeIcon('book')
            }
        }
        let contextValue: string;
        if (element.type === PtaNodeType.Problem) {
            contextValue = element.isFavorite ? "problem-favorite" : "problem";
        } else {
            contextValue = "folder";
        }
        return {
            label: element.type === PtaNodeType.Problem ? `${element.label} (${element.score})` : element.label,
            collapsibleState: element.type === PtaNodeType.Problem ?
                vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: this.parseIconPathFromProblemState(element),
            command: element.type === PtaNodeType.Problem ? {
                title: "Preview Problem",
                command: "pintia.previewProblem",
                arguments: [element.psID, element.pID]
            } : undefined,
            contextValue: contextValue
        };
    }

    getChildren(element?: PtaNode): vscode.ProviderResult<PtaNode[]> {
        const limit: number = ptaConfig.getPageSize();
        const paged: boolean = limit !== 0;

        if (!ptaManager.getUserSession()) {
            return null;
        }
        if (!element) {
            // root directory
            return explorerNodeManager.getRootNodes();
        }

        const value: IPtaNodeValue = element.value;
        if (!value) {
            return null;
        }
        if (!value.summaries) {
            // 可能由于网络访问过快，summaries 为空
            return ptaApi.getProblemSummary(element.psID).then((summaries) => {
                value.summaries = summaries;
                return this.getChildren(element);
            });
        }
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
            return this.context.asAbsolutePath(path.join("resources", "imgs", "lock.png"));
        }
        if (element.type !== PtaNodeType.Problem) {
            return "";
        }
        switch (element.state) {
            case ProblemSubmissionState.PROBLEM_ACCEPTED:
                return this.context.asAbsolutePath(path.join("resources", "imgs", "check.png"));
            case ProblemSubmissionState.PROBLEM_WRONG_ANSWER:
                return this.context.asAbsolutePath(path.join("resources", "imgs", "x.png"));
            case ProblemSubmissionState.PROBLEM_NO_ANSWER:
                return this.context.asAbsolutePath(path.join("resources", "imgs", "blank.png"));
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