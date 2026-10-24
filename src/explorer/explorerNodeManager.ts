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
import {
    createDefaultPtaNode,
    IPtaNode,
    IPtaNodeValue,
    ProblemPermissionEnum,
    ProblemSetExamStatus,
    ProblemSubmissionState,
    ProblemType,
    problemTypeInfoMapping,
    PtaDashType,
    PtaNodeType,
    supportedProblemTypes,
    UNKNOWN,
} from "../shared";
import { ptaApi } from "../utils/api";
import { DialogType, promptForOpenOutputChannel, showYesOrNoPick } from "../utils/uiUtils";
import { PtaNode } from "./PtaNode";
import { IExam, IProblemSetExam } from "../entity/IProblemSetExam";

class ExplorerNodeManager implements Disposable {
    /**
     * 节点实例缓存。
     *
     * `TreeView.reveal` 与 `getParent` 依赖对象身份：同一次树生命周期内，
     * 同一个 key 必须返回同一个 PtaNode；否则 reveal 找不到目标节点。
     */
    private readonly nodeCache = new Map<string, PtaNode>();
    /** 题目列表缓存：reveal 查找后，树展开同一页时不再重复请求接口 */
    private readonly childrenCache = new Map<string, PtaNode[]>();

    private getOrCreateNode(key: string, factory: () => PtaNode): PtaNode {
        const cached = this.nodeCache.get(key);
        if (cached) {
            return cached;
        }
        const node = factory();
        this.nodeCache.set(key, node);
        return node;
    }

    private getOrUpdateNode(key: string, data: IPtaNode): PtaNode {
        const cached = this.nodeCache.get(key);
        if (cached) {
            cached.update(data);
            return cached;
        }
        const node = new PtaNode(data);
        this.nodeCache.set(key, node);
        return node;
    }

    /** 清空节点与列表缓存；刷新、登录/登出、重建树时调用 */
    public clearCache(): void {
        this.nodeCache.clear();
        this.childrenCache.clear();
    }

    /**
     * 根据节点的父级元数据还原父节点，供 `TreeDataProvider.getParent` 使用。
     *
     * 缓存未命中时构造一个最小节点并写入缓存；后续 `getRootNodes` 会就地更新它。
     */
    public getParentNode(element: PtaNode): PtaNode | undefined {
        const value = element.value;
        switch (value.parentType) {
            case PtaNodeType.ProblemSet:
                return this.getSetNode(element.psID, value.problemSet);
            case PtaNodeType.ProblemSubSet:
                return this.getSubSetNode(element.psID, value.problemType, value.problemSet);
            case PtaNodeType.ProblemPage:
                return this.getPageNode(
                    element.psID,
                    value.problemType,
                    value.parentPage ?? 0,
                    value.total,
                    value.limit,
                    value.problemSet,
                    value.pageParentType ?? PtaNodeType.ProblemSet
                );
            default:
                return undefined;
        }
    }

    private getSetNode(psID: string, psName: string): PtaNode {
        return this.getOrCreateNode(
            `set:${psID}`,
            () =>
                new PtaNode(
                    createDefaultPtaNode({
                        psID,
                        label: psName,
                        type: PtaNodeType.ProblemSet,
                        // 显式置空，让 getChildren 走懒加载拿真实 summaries；
                        // 若留默认零值对象，会被误判为「已加载但没有题」
                        value: { problemSet: psName, summaries: undefined as never },
                    })
                )
        );
    }

    private getSubSetNode(psID: string, problemType: ProblemType, psName: string): PtaNode {
        return this.getOrCreateNode(
            `subset:${psID}:${problemType}`,
            () =>
                new PtaNode(
                    createDefaultPtaNode({
                        psID,
                        type: PtaNodeType.ProblemSubSet,
                        label: problemTypeInfoMapping.get(problemType)?.name ?? UNKNOWN,
                        value: {
                            problemSet: psName,
                            problemType,
                            parentType: PtaNodeType.ProblemSet,
                            summaries: undefined as never,
                        },
                    })
                )
        );
    }

    private getPageNode(
        psID: string,
        problemType: ProblemType,
        page: number,
        total: number,
        limit: number,
        psName: string,
        parentType: PtaNodeType
    ): PtaNode {
        const effectiveLimit = limit > 0 ? limit : 100;
        const start = page * effectiveLimit + 1;
        const end = total > 0 ? Math.min((page + 1) * effectiveLimit, total) : start;
        return this.getOrUpdateNode(
            `page:${psID}:${problemType}:${page}`,
            createDefaultPtaNode({
                psID,
                type: PtaNodeType.ProblemPage,
                label: `${start}-${end}`,
                value: {
                    total,
                    limit: effectiveLimit,
                    page,
                    problemType,
                    problemSet: psName,
                    parentType,
                },
            })
        );
    }

    private getProblemSetNode(item: IProblemSet, isMyProblemSet: boolean, locked: boolean): PtaNode {
        const data = createDefaultPtaNode({
            psID: item.id,
            label: item.name,
            type: PtaNodeType.ProblemSet,
            locked,
            value: { problemSet: item.name, summaries: item.summaries },
            isMyProblemSet,
        });
        return this.getOrUpdateNode(`set:${item.id}`, data);
    }

    public async getRootNodes(): Promise<PtaNode[]> {
        const cachedRoots = this.childrenCache.get("root");
        if (cachedRoots) {
            return cachedRoots;
        }
        const sections: IDashSection[] = await ptaApi.getDashSections();
        const ptaNodeList: PtaNode[] = [];
        const publicProblemSetList: IProblemSet[] = await ptaApi.getAlwaysAvailableProblemSets(
            ptaManager.getUserSession()?.cookie
        );
        // 走磁盘缓存（TTL 见 MY_PROBLEM_SETS_CACHE_TTL_MS）：该列表的读取代价是 1+N+M 次请求
        // （列表 + 每套题 /exams + 每套题 /problem-summaries），而每次刷新资源管理器都会走到这里，
        // 不缓存极易触发服务端的 429 限流
        const myProblemSetList: IProblemSet[] = await ptaApi.getMyProblemSets(
            ptaManager.getUserSession()?.cookie ?? "",
            true,
            true
        );
        const showLocked: boolean = ptaConfig.getShowLocked();

        const pbs2dash = new Map<string, string>();
        const dashes = new Map<string, Array<any>>();
        for (const section of sections) {
            section.displayConfigs.forEach((e) => pbs2dash.set(e.problemSetId, section.title));
            dashes.set(section.title, []);
        }
        dashes.set(PtaDashType.Others, []);
        for (const item of publicProblemSetList) {
            if (
                (item.permission?.permission ?? ProblemPermissionEnum.UNKNOWN) === ProblemPermissionEnum.LOCKED &&
                !showLocked
            ) {
                continue;
            }
            dashes.get(pbs2dash.get(item.id) ?? PtaDashType.Others)?.push(item);
        }
        dashes.set(PtaDashType.MyProblemSet, myProblemSetList);
        for (const [sectionTitle, pbsList] of dashes) {
            if (pbsList.length === 0) {
                continue;
            }
            // 分组标识是稳定标识符（见 shared.PtaDashType），展示名在这里生成
            const isMyProblemSet = sectionTitle === PtaDashType.MyProblemSet;
            const label =
                sectionTitle === PtaDashType.MyProblemSet
                    ? l10n.t("My Problem Sets")
                    : sectionTitle === PtaDashType.Others
                      ? l10n.t("Others")
                      : sectionTitle;
            ptaNodeList.push(
                this.getOrCreateNode(
                    `dash:${sectionTitle}`,
                    () =>
                        new PtaNode(
                            createDefaultPtaNode({
                                label,
                                type: PtaNodeType.Dashboard,
                                isMyProblemSet,
                            })
                        )
                )
            );
            pbsList.forEach((item) => {
                ptaNodeList.push(
                    this.getProblemSetNode(
                        item,
                        sectionTitle === PtaDashType.MyProblemSet,
                        (item.permission?.permission ?? ProblemPermissionEnum.UNKNOWN) === ProblemPermissionEnum.LOCKED
                    )
                );
            });
        }
        this.childrenCache.set("root", ptaNodeList);
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
                nodeList.push(
                    this.getOrUpdateNode(
                        `subset:${node.psID}:${problemType}`,
                        createDefaultPtaNode({
                            psID: node.psID,
                            type: PtaNodeType.ProblemSubSet,
                            label: problemTypeInfoMapping.get(problemType)?.name ?? UNKNOWN,
                            value: {
                                ...value,
                                problemType: problemType as ProblemType,
                                parentType: PtaNodeType.ProblemSet,
                            },
                        })
                    )
                );
            }
        }
        return nodeList;
    }

    public async getProblemNodes(element: PtaNode, page?: number, limit?: number): Promise<PtaNode[]> {
        try {
            const [psID, psName, problemType] = [
                element.psID,
                element.value.problemSet,
                element.value.problemType as ProblemType,
            ];
            const cacheKey = `problems:${psID}:${problemType}:${page ?? "all"}`;
            const cached = this.childrenCache.get(cacheKey);
            if (cached) {
                return cached;
            }
            const userSession: IUserSession | undefined = ptaManager.getUserSession();
            if (!userSession) {
                return [];
            }

            let exam: IExam | undefined;
            if (element.isMyProblemSet) {
                const exams: IProblemSetExam = await ptaApi.getProblemSetExams(psID, userSession.cookie);
                exam = exams?.exam;
                if (exams && !exams.exam) {
                    if (exams.status === ProblemSetExamStatus.READY) {
                        // 私有题目集不应自动创建 exam, 询问用户是否创建
                        const created = await showYesOrNoPick(
                            l10n.t("The exam is not started yet. Do you want to start the exam now?")
                        );
                        if (!created) {
                            return [];
                        }
                        await vscode.window.withProgress(
                            {
                                location: vscode.ProgressLocation.Notification,
                                title: l10n.t("Creating exam for {0}...", psName),
                                cancellable: false,
                            },
                            // 必须 await：否则下面的 checkAndCreateProblemSetExam 会与创建竞态，
                            // 查不到 exam 时再 POST 一次
                            async () => {
                                await ptaApi.createProblemSetExam(psID, userSession.cookie);
                            }
                        );
                    } else if (exams.status === ProblemSetExamStatus.PENDING) {
                        vscode.window.showErrorMessage(
                            l10n.t("The exam is not ready yet. Please wait for the exam to start.")
                        );
                        return [];
                    }
                }
            }
            // 上面已经查过 /exams 的题集不再重复请求——每次展开列表都会走到这里
            exam ??= await ptaApi.checkAndCreateProblemSetExam(psID, userSession.cookie);
            if (!exam) {
                promptForOpenOutputChannel(
                    l10n.t("Failed to create exam. Please check the output channel for details."),
                    DialogType.error
                );
                return [];
            }
            let problemList: IProblemInfo[],
                startIndex = 1;
            if (page !== undefined && limit !== undefined) {
                problemList = await ptaApi.getProblemInfoListByPage(psID, problemType, page, limit);
                startIndex = page * limit + 1;
            } else {
                problemList = await ptaApi.getAllProblemInfoList(psID, problemType);
            }

            let examProblemStatus: IExamProblemStatus[] | undefined;
            let problemExamMapping: Map<string, ProblemSubmissionState> = new Map();

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: l10n.t("Fetching user's exams for {0}...", psName),
                    cancellable: false,
                },
                async () => {
                    ptaChannel.info("Refetching user's exams");
                    examProblemStatus = await ptaApi.getExamProblemStatus(psID, userSession.cookie);
                    if (!examProblemStatus) {
                        throw new Error(`The examStatus is undefined. ProblemSetID is ${psID}`);
                    }
                    for (const e of examProblemStatus) {
                        problemExamMapping.set(e.id, e.problemSubmissionStatus as ProblemSubmissionState);
                    }
                }
            );

            const ptaNodeList: PtaNode[] = [];
            const isPageParent = element.type === PtaNodeType.ProblemPage;
            for (let i = 0; i < problemList.length; i++) {
                const pb: IProblemInfo = problemList[i];
                ptaNodeList.push(
                    this.getOrUpdateNode(
                        `problem:${psID}:${pb.id}`,
                        createDefaultPtaNode({
                            pID: pb.id,
                            psID: psID,
                            title: `${pb.label} ${pb.title}`,
                            label: `[${i + startIndex}] ${pb.label} ${pb.title}`,
                            type: PtaNodeType.Problem,
                            score: pb.score,
                            state: problemExamMapping.get(pb.id) ?? ProblemSubmissionState.PROBLEM_NO_ANSWER,
                            isFavorite: favoriteProblemsManager.isFavoriteProblem(
                                favoriteProblemsManager.getCurrentUserId(),
                                pb.id
                            ),
                            value: {
                                problemType: problemType,
                                problemInfo: pb,
                                problemSet: psName,
                                parentType: element.type,
                                ...(isPageParent
                                    ? {
                                          parentPage: element.value.page,
                                          pageParentType: element.value.parentType,
                                          total: element.value.total,
                                          limit: element.value.limit,
                                      }
                                    : {}),
                            },
                        })
                    )
                );
            }
            this.childrenCache.set(cacheKey, ptaNodeList);
            return ptaNodeList;
        } catch (error: any) {
            ptaChannel.error(error.toString());
            promptForOpenOutputChannel(
                l10n.t("Failed to fetch the problem list. Please check the output channel for details."),
                DialogType.error
            );
            return [];
        }
    }

    public async getProblemSetPageNodes(element: PtaNode, total: number, limit?: number): Promise<PtaNode[]> {
        if (limit === undefined) {
            limit = 100;
        }
        const [psID, psName, problemType] = [
            element.psID,
            element.value.problemSet,
            element.value.problemType as ProblemType,
        ];

        const nodeList: PtaNode[] = [];
        const pageNum: number = Math.ceil(total / limit);

        for (let i = 0; i < pageNum; i++) {
            nodeList.push(this.getPageNode(psID, problemType, i, total, limit, psName, element.type));
        }
        return nodeList;
    }

    dispose() {}
}

export const explorerNodeManager: ExplorerNodeManager = new ExplorerNodeManager();
