import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { IProblemInfo } from "../../../src/entity/IProblemInfo";
import { setGlobalContext } from "../../../src/globalContext";
import { ProblemType } from "../../../src/shared";
import { PtaPreviewProvider } from "../../../src/webview/PtaPreviewProvider";
import { ProblemView } from "../../../src/webview/views/ProblemView";
import { resetVscodeMock } from "../../setup";

function createProblemInfo(id: string): IProblemInfo {
    return {
        id,
        label: id,
        score: 10,
        deadline: "",
        acceptCount: 0,
        submitCount: 0,
        title: `T-${id}`,
        type: ProblemType.PROGRAMMING,
        compiler: "GXX",
        problemStatus: "",
        problemSetId: "ps1",
        problemPoolIndex: 0,
        indexInProblemPool: 0,
    };
}

/**
 * CSP 只有真正落到渲染出的 HTML 上才有意义，而 head 里的 nonce 必须与
 * body 里 `<script>` 的 nonce 一致——不一致时脚本会被静默拦掉，
 * 表现为「复制按钮没反应」，靠单测断言字符串本身发现不了。
 */
describe("PtaPreviewProvider - 渲染出的 HTML", () => {
    /** 造一个字段齐全、fetch 已被替换的 ProblemView */
    function createProblem(): ProblemView {
        const problem = new ProblemView("ps1", "p1");
        Object.assign(problem, {
            id: "p1",
            label: "1-1",
            title: "两数之和",
            problemSetId: "ps1",
            problemSetName: "练习集",
            organization: "某单位",
            author: "某作者",
            content: "题面 $$a+b$$",
            problemNote: "我的笔记内容",
            lastProgram: "int main(){}",
            lastSubmittedLang: "C++ (g++)",
            type: ProblemType.PROGRAMMING,
            score: 10,
            submitCount: 2,
            acceptCount: 1,
            problemConfig: {},
        });
        sinon.stub(problem, "fetch").resolves(problem);
        return problem;
    }

    /** 造一个位于列表指定位置的题目 */
    function createProblemAt(id: string, ids: string[]): ProblemView {
        const problem = createProblem();
        problem.id = id;
        problem.label = id;
        problem.title = `标题 ${id}`;
        problem.problemInfoList = ids.map(createProblemInfo);
        return problem;
    }

    /**
     * 触发一次渲染并取回写进 webview 的 HTML。
     *
     * provider 是单例、面板也只创建一次（后续渲染复用同一个面板），
     * 而 `resetVscodeMock()` 会清掉 stub 的调用记录，因此这里缓存首次拿到的面板。
     */
    let capturedPanel: { webview: { html: string; onDidReceiveMessage: sinon.SinonStub } } | undefined;

    async function renderHtml(problem: ProblemView = createProblem()): Promise<string> {
        const panelStub = vscode.window.createWebviewPanel as sinon.SinonStub;
        await PtaPreviewProvider.createOrUpdate(problem).show();
        if (panelStub.called) {
            capturedPanel = panelStub.lastCall.returnValue;
        }
        assert.ok(capturedPanel, "webview 面板从未被创建");
        return capturedPanel.webview.html;
    }

    /** 取出某个按钮标签，便于断言 disabled / data-pid */
    function buttonTag(html: string, id: string): string {
        return html.match(new RegExp(`<button id="${id}"[^>]*>`))?.[0] ?? "";
    }

    beforeEach(() => {
        resetVscodeMock();
        setGlobalContext({ extensionUri: vscode.Uri.file("/ext") } as never);
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("head 里应带上 Content-Security-Policy", async () => {
        const html = await renderHtml();

        assert.ok(html.includes('http-equiv="Content-Security-Policy"'), "缺少 CSP meta");
        assert.ok(html.includes("default-src 'none'"), "CSP 缺少兜底指令");
        assert.ok(html.includes("font-src"), "CSP 缺少 font-src，KaTeX 字体将无法加载");
    });

    it("CSP 的 nonce 应与 script 标签的 nonce 一致", async () => {
        const html = await renderHtml();

        const cspNonce = html.match(/script-src 'nonce-([^']+)'/)?.[1];
        const scriptNonce = html.match(/<script nonce="([^"]+)"/)?.[1];

        assert.ok(cspNonce, "CSP 里没有 nonce");
        assert.ok(scriptNonce, "script 标签上没有 nonce");
        assert.strictEqual(scriptNonce, cspNonce, "两处 nonce 不一致会导致脚本被 CSP 拦掉");
    });

    it("应把复制按钮的文案通过 data 属性注入（webview 脚本取不到 l10n）", async () => {
        const html = await renderHtml();

        assert.ok(html.includes("data-copy-label="), "缺少复制按钮文案");
        assert.ok(html.includes("data-copied-label="), "缺少复制成功提示文案");
    });

    it("题目正文里的公式应渲染为 KaTeX，而不是残留 $$", async () => {
        const html = await renderHtml();

        assert.ok(html.includes("katex"), "公式未渲染");
        assert.ok(!html.includes("$$"), "不应残留 $$ 标记");
    });

    it("题目名与题集名应转义后写入 HTML", async () => {
        const problem = createProblem();
        problem.title = '"><script>alert(1)</script>';
        problem.problemSetName = "<b>题集</b>";
        const panelStub = vscode.window.createWebviewPanel as sinon.SinonStub;

        await PtaPreviewProvider.createOrUpdate(problem).show();

        const html = (capturedPanel ?? panelStub.lastCall.returnValue).webview.html as string;
        assert.ok(!html.includes("<b>题集</b>"), "题集名未转义");
        assert.ok(!html.includes("<script>alert(1)</script>"), "题名未转义");
    });

    describe("上一题 / 下一题", () => {
        it("中间题目应渲染两个可用按钮并带目标 pID", async () => {
            const html = await renderHtml(createProblemAt("p2", ["p1", "p2", "p3"]));

            const prev = buttonTag(html, "btnPrevProblem");
            const next = buttonTag(html, "btnNextProblem");
            assert.ok(prev.includes('data-psid="ps1"') && prev.includes('data-pid="p1"'), prev);
            assert.ok(next.includes('data-psid="ps1"') && next.includes('data-pid="p3"'), next);
            assert.ok(!prev.includes("disabled"), "中间题不应禁用上一题");
            assert.ok(!next.includes("disabled"), "中间题不应禁用下一题");
        });

        it("第一题应禁用上一题", async () => {
            const html = await renderHtml(createProblemAt("p1", ["p1", "p2"]));

            assert.ok(buttonTag(html, "btnPrevProblem").includes("disabled"), html);
            assert.ok(buttonTag(html, "btnNextProblem").includes('data-pid="p2"'), html);
        });

        it("最后一题应禁用下一题", async () => {
            const html = await renderHtml(createProblemAt("p2", ["p1", "p2"]));

            assert.ok(buttonTag(html, "btnNextProblem").includes("disabled"), html);
            assert.ok(buttonTag(html, "btnPrevProblem").includes('data-pid="p1"'), html);
        });

        it("只有一道题时不渲染导航", async () => {
            const html = await renderHtml(createProblemAt("p1", ["p1"]));

            assert.ok(!html.includes("btnPrevProblem"), html);
            assert.ok(!html.includes("btnNextProblem"), html);
        });

        it("导航按钮应位于底栏并使用 SVG 箭头图标", async () => {
            const html = await renderHtml(createProblemAt("p2", ["p1", "p2", "p3"]));

            assert.ok(
                html.indexOf('class="button-container"') < html.indexOf('class="nav-buttons"'),
                "导航按钮应在底部按钮条内"
            );
            assert.ok(html.includes('d="M10 3 5 8l5 5"'), "上一题应使用左向 SVG 图标");
            assert.ok(html.includes('d="M6 3l5 5-5 5"'), "下一题应使用右向 SVG 图标");
            assert.ok(!html.includes("←") && !html.includes("→"), "不应再使用文本箭头");
        });

        it("点击下一题应执行 pintia.previewProblem", async () => {
            await renderHtml(createProblemAt("p2", ["p1", "p2", "p3"]));
            const call = capturedPanel!.webview.onDidReceiveMessage.firstCall;
            const handler = (call.args[0] as (msg: unknown) => Promise<void>).bind(call.args[1]);

            await handler({
                type: "command",
                value: "pintia.previewProblemById",
                args: ["ps1", "p3"],
            });

            assert.deepStrictEqual((vscode.commands.executeCommand as sinon.SinonStub).firstCall.args, [
                "pintia.previewProblem",
                "ps1",
                "p3",
                false,
            ]);
        });
    });
});
