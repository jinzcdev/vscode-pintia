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
        vscode.commands.registerCommand("pintia.openPintiaHome", () => user.openPintiaHome()),
        vscode.commands.registerCommand("pintia.openExtensionRepo", () => user.openExtensionRepo()),
        vscode.commands.registerCommand("pintia.refreshExplorer", async () => {
            // 手动刷新的语义是「拉取最新的」，因此先让题集列表缓存失效
            await ptaApi.invalidateProblemSetsCache();
            explorerController.refreshTreeData();
        }),
        vscode.commands.registerCommand("pintia.clearCache", () => cache.clearCache()),
        vscode.commands.registerCommand("pintia.signIn", () => ptaManager.signIn()),
        vscode.commands.registerCommand("pintia.signOut", () => ptaManager.signOut()),
        vscode.commands.registerCommand(
            "pintia.previewProblem",
            async (psID: string, pID: string, codeIt: boolean = true) => {
                const problem = await new ProblemView(psID, pID).fetch();
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
            }
        ),
        vscode.commands.registerCommand("pintia.manageUser", () => user.showUserManager()),
        vscode.commands.registerCommand("pintia.checkIn", () => user.checkInPTA()),
        vscode.commands.registerCommand("pintia.reportIssue", () => user.reportIssue()),
        vscode.commands.registerCommand("pintia.searchProblem", () => show.searchProblem()),
        vscode.commands.registerCommand("pintia.refreshProblemSearchIndex", () => cache.refreshProblemSearchIndex()),
        vscode.commands.registerCommand("pintia.codeProblem", (ptaCode: IPtaCode) => show.showCodingEditor(ptaCode)),
        vscode.commands.registerCommand("pintia.testCustomSample", (ptaCode: IPtaCode, index: number) =>
            submit.testCustomSample(ptaCode, index)
        ),
        vscode.commands.registerCommand("pintia.submitSolution", (ptaCode: IPtaCode) => submit.submitSolution(ptaCode)),
        vscode.commands.registerCommand("pintia.testSolution", (ptaCode: IPtaCode) => submit.testSolution(ptaCode)),
        vscode.commands.registerCommand("pintia.changeDefaultLanguage", () => language.changeDefaultLanguage()),
        vscode.commands.registerCommand("pintia.changeWorkspaceFolder", () => workspace.changeWorkspaceFolder()),
        vscode.commands.registerCommand("pintia.openWorkspace", () => workspace.openWorkspace()),
        vscode.commands.registerCommand("pintia.welcome", () => {
            vscode.commands.executeCommand(`workbench.action.openWalkthrough`, `jinzcdev.vscode-pintia#pintia`, false);
        }),
        vscode.commands.registerCommand("pintia.addFavorite", (ptaNode: PtaNode) => star.addFavoriteProblem(ptaNode)),
        vscode.commands.registerCommand("pintia.removeFavorite", (ptaNode: PtaNode) =>
            star.removeFavoriteProblem(ptaNode.pID)
        ),
        vscode.commands.registerCommand("pintia.clearViewedProblems", async () => {
            await historyManager.clearViewedProblems();
            historyTreeDataProvider.refresh();
        }),
        vscode.commands.registerCommand("pintia.clearFavoriteProblems", async () => {
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
        vscode.commands.registerCommand("pintia.checkLastSubmission", async (ptaCode: IPtaCode) => {
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
        vscode.commands.registerCommand("pintia.toggleTimer", () => timer.toggleTimer()),
        vscode.commands.registerCommand("pintia.timerCodeLens", (problem: IPtaProblem) =>
            timer.toggleTimerForProblem(problem)
        ),
        vscode.commands.registerCommand("pintia.timerMenu", () => timer.showTimerMenu()),
        vscode.commands.registerCommand("pintia.showTimerStats", () => timer.showTimerStats()),
        vscode.commands.registerCommand("pintia.submitSolutionByShortcut", executeSubmitSolution),
        vscode.commands.registerCommand("pintia.testSolutionByShortcut", executeTestSolution)
    );
}

export { getGlobalContext } from "./globalContext";

export function deactivate() {
    // 运行中的计时器只在内存里推进，退出前把最后一段秒数落盘
    return timerManager.dispose();
}
