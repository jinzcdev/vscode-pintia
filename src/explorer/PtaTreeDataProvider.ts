import * as vscode from "vscode";
import { l10n } from "vscode";
import * as path from "path";
import { PtaNode } from "./PtaNode";
import { IPtaNodeValue, ProblemSubmissionState, ProblemType, PtaNodeType } from "../shared";
import { ptaManager } from "../ptaManager";
import { explorerNodeManager } from "./explorerNodeManager";
import { ptaConfig } from "../ptaConfig";
import { IProblemSummary } from "../entity/IProblemSummary";
import { ptaApi } from "../utils/api";

export class PtaTreeDataProvider implements vscode.TreeDataProvider<PtaNode>, vscode.Disposable {
    private context: vscode.ExtensionContext | undefined;
    private configurationChangeListener: vscode.Disposable;

    private onDidChangeTreeDataEvent: vscode.EventEmitter<PtaNode | undefined | null> = new vscode.EventEmitter<
        PtaNode | undefined | null
    >();

    public readonly onDidChangeTreeData: vscode.Event<any> = this.onDidChangeTreeDataEvent.event;

    public constructor(context: vscode.ExtensionContext) {
        this.configurationChangeListener = vscode.workspace.onDidChangeConfiguration(
            (event: vscode.ConfigurationChangeEvent) => {
                if (
                    event.affectsConfiguration("pintia.paging.pageSize") ||
                    event.affectsConfiguration("pintia.showLocked")
                ) {
                    this.onDidChangeTreeDataEvent.fire(null);
                }
            },
            this
        );
        this.context = context;
    }

    getTreeItem(element: PtaNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        if (!element) {
            return {
                label: "",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
            };
        }
        if (element.type === PtaNodeType.Dashboard) {
            return {
                label: `— ${element.label} —`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                // 用节点自身的标记判断，而不是拿 label 与分组标识比较：
                // label 是本地化后的展示文案，与标识符不再相等
                iconPath: element.isMyProblemSet ? new vscode.ThemeIcon("smiley") : new vscode.ThemeIcon("book"),
            };
        }
        let contextValue: string;
        if (element.type === PtaNodeType.Problem) {
            contextValue = element.isFavorite ? "problem-favorite" : "problem";
        } else {
            contextValue = "folder";
        }
        return {
            label: element.type === PtaNodeType.Problem ? `${element.label} (${element.score})` : element.label,
            collapsibleState:
                element.type === PtaNodeType.Problem
                    ? vscode.TreeItemCollapsibleState.None
                    : vscode.TreeItemCollapsibleState.Collapsed,
            iconPath: this.parseIconPathFromProblemState(element),
            command:
                element.type === PtaNodeType.Problem
                    ? {
                          title: l10n.t("Preview Problem"),
                          command: "pintia.previewProblem",
                          arguments: [element.psID, element.pID],
                      }
                    : undefined,
            contextValue: contextValue,
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
        // 分页节点不需要 summaries（它的题目数来自 value.total），必须在懒加载
        // 分支之前处理，否则每次展开分页都会白打一次 problem-summaries
        if (element.type === PtaNodeType.ProblemPage) {
            return explorerNodeManager.getProblemNodes(element, value.page, limit);
        }
        if (!value.summaries) {
            // summaries 为空时尝试懒加载；403 等失败返回 {}，避免反复重试
            return ptaApi.getProblemSummary(element.psID).then((summaries) => {
                value.summaries = summaries;
                if (Object.keys(summaries).length === 0) {
                    return [];
                }
                return this.getChildren(element);
            });
        }
        if (Object.keys(value.summaries).length === 0) {
            return [];
        }
        if (element.type === PtaNodeType.ProblemSet) {
            if (Object.keys(value.summaries).length > 1) {
                return explorerNodeManager.getSubProblemSet(element);
            }
            const problemType: string = Object.keys(value.summaries)[0];
            const total: number = value.summaries[problemType as keyof IProblemSummary]?.total ?? 0;
            element.value.problemType = problemType as ProblemType;

            if (!paged || total < limit) {
                // 1-200, 201-400
                return explorerNodeManager.getProblemNodes(element);
            } else {
                return explorerNodeManager.getProblemSetPageNodes(element, total, limit);
            }
        }

        if (element.type === PtaNodeType.ProblemSubSet) {
            const total: number = value.summaries[value.problemType]?.total ?? 0;
            // node.type === PtaNodeType.ProblemType
            if (!paged || total < limit) {
                return explorerNodeManager.getProblemNodes(element);
            } else {
                return explorerNodeManager.getProblemSetPageNodes(element, total, limit);
            }
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
