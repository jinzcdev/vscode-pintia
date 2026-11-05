import * as fs from "fs-extra";
import * as vscode from "vscode";
import { codeLensController } from "./codelens/CodeLensController";
import * as cache from "./commands/cache";
import * as language from "./commands/language";
import * as show from "./commands/show";
import * as star from "./commands/star";
import * as submit from "./commands/submit";
import * as timer from "./commands/timer";
import * as user from "./commands/user";
import * as workspace from "./commands/workspace";
import { explorerController } from "./explorer/explorerController";
import { PtaNode } from "./explorer/PtaNode";
import { favoriteProblemsManager } from "./favorites/favoriteProblemsManager";
import { favoritesTreeDataProvider } from "./favorites/favoritesTreeDataProvider";
import { ptaChannel } from "./ptaChannel";
import { ptaConfig } from "./ptaConfig";
import { ptaExecutor } from "./ptaExecutor";
import { ptaManager } from "./ptaManager";
import { configPath, IPtaCode, IPtaProblem, UserStatus } from "./shared";
import { setGlobalContext } from "./globalContext";
import { ptaStatusBarController } from "./statusbar/ptaStatusBarController";
import { timerController } from "./timer/timerController";
import { timerManager } from "./timer/timerManager";
import { registerCommandWithTelemetry } from "./telemetry/commandTelemetry";
import { PreviewSource, TELEMETRY_EVENTS } from "./telemetry/events";
import { telemetryService } from "./telemetry/telemetryService";
import { ptaApi } from "./utils/api";
import {
    executeSubmitSolution,
    executeTestSolution,
    getProblemFromDocument,
    updatePtaValidCodeContext,
} from "./utils/editorUtils";
import { historyManager } from "./view-history/historyManager";
import { historyTreeDataProvider } from "./view-history/historyTreeDataProvider";
import { PtaPreviewProvider } from "./webview/PtaPreviewProvider";
import { PtaSubmissionProvider } from "./webview/PtaSubmissionProvider";
import { ProblemView } from "./webview/views/ProblemView";

export async function activate(context: vscode.ExtensionContext) {
    setGlobalContext(context);
    telemetryService.initialize(context, () => ptaManager.getUserSession());
    context.subscriptions.push(telemetryService);
    // 尽早发送，避免用户开窗后很快关闭导致当天的 DAU 丢失；登录态由后续事件携带。
    telemetryService.trackEvent(TELEMETRY_EVENTS.SESSION_START);

    /** 让题目集视图定位到当前活动编辑器对应的题目（不在题目文件时不做任何事） */
    const scheduleActiveProblemReveal = (editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor) => {
        const problem = editor ? getProblemFromDocument(editor.document) : undefined;
        if (problem) {
            explorerController.scheduleRevealProblem(problem.psID, problem.pID);
        }
    };

    ptaManager.on("statusChanged", async () => {
        const userStatus: UserStatus = ptaManager.getStatus();
        if (userStatus === UserStatus.SignedIn) {
            vscode.commands.executeCommand("setContext", "pintia.showWelcome", false);
            // 先记录待定位题目：createTreeView 创建视图后若可见会立即执行
            scheduleActiveProblemReveal();
            explorerController.createTreeView(context);
        } else {
            explorerController.dispose();
            vscode.commands.executeCommand("setContext", "pintia.showWelcome", true);
        }
        Promise.all([historyTreeDataProvider.refresh(), favoritesTreeDataProvider.refresh()]);
        ptaStatusBarController.updateStatusBar(ptaManager.getUserSession());
    });

    // 组合根接线：ptaManager 不 import commands/*，需要联动的事情靠事件转达
    ptaManager.on("signedOut", () => void cache.clearCache());
    // 仅「从磁盘恢复会话」时触发，交互式登录不会走到这里
    ptaManager.on("sessionRestored", () => void user.autoCheckInPTA());

    await fs.mkdirs(configPath).then(() => {
        Promise.all([ptaManager.fetchLoginStatus(), cache.createProblemSearchIndex(context)]);
    });

    // 初始化时设置当前编辑器的上下文
    updatePtaValidCodeContext();
    scheduleActiveProblemReveal();

    // 监听编辑器变化
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            updatePtaValidCodeContext();
            // 打开题目文件时让左侧题目集视图展开并选中对应题目
            scheduleActiveProblemReveal(editor);
        }),
        vscode.workspace.onDidChangeTextDocument(() => {
            // 当文档内容变化时，只有当变化的是当前活动编辑器的文档时，才更新上下文
            if (
                vscode.window.activeTextEditor &&
                vscode.workspace.textDocuments.some((doc) => doc === vscode.window.activeTextEditor!.document)
            ) {
                updatePtaValidCodeContext();
            }
        })
    );

    context.subscriptions.push(
        ptaStatusBarController,
        timerController,
        codeLensController,
        ptaExecutor,
        ptaChannel,
        explorerController,
        favoriteProblemsManager,
        historyManager,
        vscode.window.createTreeView("pintiaProblemHistory", {
            treeDataProvider: historyTreeDataProvider,
            showCollapseAll: true,
        }),
        vscode.window.createTreeView("pintiaMyFavorites", {
            treeDataProvider: favoritesTreeDataProvider,
            showCollapseAll: true,
        }),
        registerCommandWithTelemetry("pintia.openPintiaHome", () => user.openPintiaHome()),
        registerCommandWithTelemetry("pintia.openExtensionRepo", () => user.openExtensionRepo()),
        registerCommandWithTelemetry("pintia.refreshExplorer", async () => {
            // 手动刷新的语义是「拉取最新的」，因此先让题集列表缓存失效
            await ptaApi.invalidateProblemSetsCache();
            explorerController.refreshTreeData();
        }),
        registerCommandWithTelemetry("pintia.clearCache", () => cache.clearCache()),
        registerCommandWithTelemetry("pintia.signIn", () => ptaManager.signIn()),
        registerCommandWithTelemetry("pintia.signOut", () => ptaManager.signOut()),
        registerCommandWithTelemetry(
            "pintia.previewProblem",
            async (psID: string, pID: string, codeIt: boolean = true, source: PreviewSource = "unknown") => {
                const startedAt = Date.now();
                let fetchMs = 0;
                try {
                    const fetchStartedAt = Date.now();
                    const problem = await new ProblemView(psID, pID).fetch();
                    fetchMs = Date.now() - fetchStartedAt;

                    await PtaPreviewProvider.createOrUpdate(problem)
                        .show()
                        .then(async () => {
                            await historyManager.addProblem(historyManager.getCurrentUserId(), {
                                pID: problem.id,
                                psID: problem.problemSetId,
                                psName: problem.problemSetName,
                                title: `${problem.label} ${problem.title}`,
                            });
                            historyTreeDataProvider.refresh();
                            if (codeIt && ptaConfig.getPreviewProblemAndCodeIt()) {
                                show.showCodingEditor(ProblemView.toPtaNode(problem));
                            }
                        });

                    telemetryService.trackEvent(
                        TELEMETRY_EVENTS.PREVIEW_OPEN,
                        {
                            source,
                            hasLastProgram: (problem.lastProgram ?? "").trim().length > 0,
                        },
                        { fetchMs, totalMs: Date.now() - startedAt }
                    );
                } catch (error) {
                    telemetryService.trackError(TELEMETRY_EVENTS.ERROR, error, {
                        command: "previewProblem",
                        source,
                    });
                    throw error;
                }
            }
        ),
        registerCommandWithTelemetry("pintia.manageUser", () => user.showUserManager()),
        registerCommandWithTelemetry("pintia.checkIn", () => user.checkInPTA()),
        registerCommandWithTelemetry("pintia.reportIssue", () => user.reportIssue()),
        registerCommandWithTelemetry("pintia.searchProblem", () => show.searchProblem()),
        registerCommandWithTelemetry("pintia.refreshProblemSearchIndex", () => cache.refreshProblemSearchIndex()),
        registerCommandWithTelemetry("pintia.codeProblem", (ptaCode: IPtaCode) => show.showCodingEditor(ptaCode)),
        registerCommandWithTelemetry("pintia.testCustomSample", (ptaCode: IPtaCode, index: number) =>
            submit.testCustomSample(ptaCode, index)
        ),
        registerCommandWithTelemetry("pintia.submitSolution", (ptaCode: IPtaCode) => submit.submitSolution(ptaCode)),
        registerCommandWithTelemetry("pintia.testSolution", (ptaCode: IPtaCode) => submit.testSolution(ptaCode)),
        registerCommandWithTelemetry("pintia.changeDefaultLanguage", () => language.changeDefaultLanguage()),
        registerCommandWithTelemetry("pintia.changeWorkspaceFolder", () => workspace.changeWorkspaceFolder()),
        registerCommandWithTelemetry("pintia.openWorkspace", () => workspace.openWorkspace()),
        registerCommandWithTelemetry("pintia.welcome", () => {
            vscode.commands.executeCommand(`workbench.action.openWalkthrough`, `jinzcdev.vscode-pintia#pintia`, false);
        }),
        registerCommandWithTelemetry("pintia.addFavorite", (ptaNode: PtaNode) => star.addFavoriteProblem(ptaNode)),
        registerCommandWithTelemetry("pintia.removeFavorite", (ptaNode: PtaNode) =>
            star.removeFavoriteProblem(ptaNode.pID)
        ),
        registerCommandWithTelemetry("pintia.clearViewedProblems", async () => {
            await historyManager.clearViewedProblems();
            historyTreeDataProvider.refresh();
        }),
        registerCommandWithTelemetry("pintia.clearFavoriteProblems", async () => {
            await favoriteProblemsManager.clearFavoriteProblems();
            favoritesTreeDataProvider.refresh();
        }),
        // 裁剪上限变化时重排历史视图。此前注册在 historyManager 内部，
        // 那会让 manager 反向依赖 tree provider
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("pintia.problemHistoryListSize")) {
                historyManager.trimAll();
                historyTreeDataProvider.refresh();
            }
        }),
        registerCommandWithTelemetry("pintia.checkLastSubmission", async (ptaCode: IPtaCode) => {
            const cookie = ptaManager.getUserSession()?.cookie ?? "";
            const submissionId = (await ptaApi.getLastSubmissions(ptaCode.psID, ptaCode.pID, cookie))?.id;
            if (submissionId) {
                const data = await ptaApi.getProblemSubmissionResult(submissionId, cookie);
                if (
                    data &&
                    data.queued === -1 &&
                    data.submission.status !== "WAITING" &&
                    data.submission.status !== "JUDGING"
                ) {
                    PtaSubmissionProvider.createOrUpdate(data).show();
                }
            } else {
                vscode.window.showInformationMessage(vscode.l10n.t("No submission history found!"));
            }
        }),
        registerCommandWithTelemetry("pintia.toggleTimer", () => timer.toggleTimer()),
        registerCommandWithTelemetry("pintia.timerCodeLens", (problem: IPtaProblem) =>
            timer.toggleTimerForProblem(problem)
        ),
        registerCommandWithTelemetry("pintia.timerMenu", () => timer.showTimerMenu()),
        registerCommandWithTelemetry("pintia.showTimerStats", () => timer.showTimerStats()),
        registerCommandWithTelemetry("pintia.submitSolutionByShortcut", executeSubmitSolution),
        registerCommandWithTelemetry("pintia.testSolutionByShortcut", executeTestSolution)
    );
}

export { getGlobalContext } from "./globalContext";

export async function deactivate() {
    // 运行中的计时器只在内存里推进，退出前把最后一段秒数落盘；同时 flush 遥测队列
    await Promise.allSettled([timerManager.dispose(), telemetryService.dispose()]);
}
