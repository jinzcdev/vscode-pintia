import * as vscode from "vscode";
import { Disposable } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { ptaConfig } from "../ptaConfig";
import { getSearchIndexStore } from "../searchIndex";
import { IIndexedProblemLocation, locateProblemInIndex } from "../searchIndex/lookup";
import { PtaNodeType, searchIndexPath } from "../shared";
import { explorerNodeManager } from "./explorerNodeManager";
import { PtaNode } from "./PtaNode";
import { PtaTreeDataProvider } from "./PtaTreeDataProvider";

/** 切换文件时的防抖：避免快速 A→B→C 触发多次树展开 */
const REVEAL_DEBOUNCE_MS = 250;

class ExplorerController implements Disposable {
    private treeView?: vscode.TreeView<PtaNode>;
    private ptaTreeDataProvider?: PtaTreeDataProvider;
    /**
     * 是否已注册进 `context.subscriptions`。
     *
     * 登出会 dispose 掉 treeView，再次登录又会走到这里；不加这个标记，
     * 每轮「登出→登录」都会往 subscriptions 里再塞一个同一个对象。
     */
    private registered = false;
    /** 最后一次需要定位的题目；PTA 视图不可见时先存起来 */
    private pendingReveal?: { psID: string; pID: string };
    private revealTimer?: ReturnType<typeof setTimeout>;
    /** 递增令牌：每个 await 后检查，过期的定位任务直接放弃 */
    private revealToken = 0;
    private visibilityListener?: vscode.Disposable;

    public createTreeView(context: vscode.ExtensionContext) {
        if (!this.treeView) {
            // 登出/重新登录会重建树；旧节点不能带进新树
            explorerNodeManager.clearCache();
            this.ptaTreeDataProvider = new PtaTreeDataProvider(context);
            this.treeView = vscode.window.createTreeView("pintiaExplorer", {
                treeDataProvider: this.ptaTreeDataProvider,
                showCollapseAll: true,
            });
            this.visibilityListener = this.treeView.onDidChangeVisibility(() => {
                if (this.treeView?.visible) {
                    this.revealPending();
                }
            });
            if (!this.registered) {
                context.subscriptions.push(this);
                this.registered = true;
            }
            if (this.treeView.visible) {
                this.revealPending();
            }
        }
    }

    public async refreshTreeData() {
        // 刷新会清空节点缓存；进行中的 reveal 立即作废
        this.revealToken++;
        this.ptaTreeDataProvider?.refresh();
    }

    /**
     * 调度「定位到某道题」。
     *
     * 只有 PTA 题目集视图可见时才真正去展开/请求；不可见时仅记住最后一题，
     * 等用户打开视图（onDidChangeVisibility）再定位。
     */
    public scheduleRevealProblem(psID: string, pID: string): void {
        if (!psID || !pID) {
            return;
        }
        this.pendingReveal = { psID, pID };
        if (!this.treeView?.visible) {
            return;
        }
        if (this.revealTimer) {
            clearTimeout(this.revealTimer);
        }
        this.revealTimer = setTimeout(() => {
            this.revealTimer = undefined;
            void this.revealProblem(psID, pID);
        }, REVEAL_DEBOUNCE_MS);
    }

    public async revealProblem(psID: string, pID: string): Promise<void> {
        if (!this.treeView || !this.ptaTreeDataProvider || !this.treeView.visible) {
            return;
        }
        const token = ++this.revealToken;
        try {
            const problemNode = await this.findProblemNode(psID, pID, token);
            if (!problemNode || token !== this.revealToken) {
                return;
            }
            await this.treeView.reveal(problemNode, { select: true, focus: false, expand: true });
        } catch (error: any) {
            ptaChannel.error(`Failed to reveal problem ${psID}|${pID}: ${error?.toString?.() ?? String(error)}`);
        }
    }

    public dispose() {
        if (this.revealTimer) {
            clearTimeout(this.revealTimer);
            this.revealTimer = undefined;
        }
        // 让进行中的 reveal 在下一个 await 后中止
        this.revealToken++;
        this.pendingReveal = undefined;
        this.visibilityListener?.dispose();
        this.visibilityListener = undefined;
        explorerNodeManager.clearCache();
        this.treeView?.dispose();
        this.ptaTreeDataProvider?.dispose();
        this.treeView = undefined;
        this.ptaTreeDataProvider = undefined;
    }

    // ---------- 定位内部实现 ----------

    private revealPending(): void {
        if (!this.treeView?.visible || !this.pendingReveal) {
            return;
        }
        if (this.revealTimer) {
            clearTimeout(this.revealTimer);
            this.revealTimer = undefined;
        }
        void this.revealProblem(this.pendingReveal.psID, this.pendingReveal.pID);
    }

    private async findProblemNode(psID: string, pID: string, token: number): Promise<PtaNode | undefined> {
        const roots = (await this.ptaTreeDataProvider!.getChildren()) ?? [];
        if (token !== this.revealToken) {
            return undefined;
        }
        const setNode = roots.find((node) => node.type === PtaNodeType.ProblemSet && node.psID === psID);
        if (!setNode) {
            return undefined;
        }

        // 优先用本地搜索索引直接算出题型与页码，通常只需 1 次题目列表请求
        const located = this.locateInSearchIndex(psID, pID);
        if (located) {
            const node = await this.findByIndex(setNode, psID, pID, located, token);
            if (node) {
                return node;
            }
            if (token !== this.revealToken) {
                return undefined;
            }
        }

        // 索引缺失/过期（例如私有题集）：逐层扫描
        return this.findByScanning(setNode, psID, pID, token);
    }

    private locateInSearchIndex(psID: string, pID: string): IIndexedProblemLocation | undefined {
        try {
            return locateProblemInIndex(getSearchIndexStore(searchIndexPath).getRawData(), psID, pID);
        } catch {
            return undefined;
        }
    }

    private async findByIndex(
        setNode: PtaNode,
        psID: string,
        pID: string,
        located: IIndexedProblemLocation,
        token: number
    ): Promise<PtaNode | undefined> {
        let parent = setNode;
        let children = (await this.ptaTreeDataProvider!.getChildren(parent)) ?? [];
        if (token !== this.revealToken) {
            return undefined;
        }

        // 多题型题集：先定位到对应题型
        if (children.some((node) => node.type === PtaNodeType.ProblemSubSet)) {
            const subSet = children.find(
                (node) => node.type === PtaNodeType.ProblemSubSet && node.value.problemType === located.problemType
            );
            if (!subSet) {
                return undefined;
            }
            parent = subSet;
            children = (await this.ptaTreeDataProvider!.getChildren(parent)) ?? [];
            if (token !== this.revealToken) {
                return undefined;
            }
        } else if (setNode.value.problemType && setNode.value.problemType !== located.problemType) {
            // 单题型题集与索引题型不一致：索引可能已过期，交给扫描回退
            return undefined;
        }

        // 分页题集：按索引中的题型内序号计算页码
        if (children.some((node) => node.type === PtaNodeType.ProblemPage)) {
            const pageSize = ptaConfig.getPageSize();
            if (pageSize <= 0) {
                return undefined;
            }
            const page = Math.floor(located.indexInType / pageSize);
            const pageNode = children.find((node) => node.type === PtaNodeType.ProblemPage && node.value.page === page);
            if (!pageNode) {
                return undefined;
            }
            parent = pageNode;
            children = (await this.ptaTreeDataProvider!.getChildren(parent)) ?? [];
            if (token !== this.revealToken) {
                return undefined;
            }
        }

        return children.find((node) => node.type === PtaNodeType.Problem && node.psID === psID && node.pID === pID);
    }

    private async findByScanning(
        node: PtaNode,
        psID: string,
        pID: string,
        token: number
    ): Promise<PtaNode | undefined> {
        if (node.type === PtaNodeType.Problem) {
            return node.psID === psID && node.pID === pID ? node : undefined;
        }
        const children = (await this.ptaTreeDataProvider!.getChildren(node)) ?? [];
        if (token !== this.revealToken) {
            return undefined;
        }
        for (const child of children) {
            const found = await this.findByScanning(child, psID, pID, token);
            if (found) {
                return found;
            }
            if (token !== this.revealToken) {
                return undefined;
            }
        }
        return undefined;
    }
}

export const explorerController: ExplorerController = new ExplorerController();
