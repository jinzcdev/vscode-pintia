import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { customCodeLensProvider } from "../../../src/codelens/CustomCodeLensProvider";
import { IActiveTimer, IPtaCode, TimerState } from "../../../src/shared";
import { timerManager } from "../../../src/timer/timerManager";
import { createFakeDocument, createProblemSource } from "../../helpers/vscodeFakes";
import { resetVscodeMock, setConfigValue } from "../../setup";

/** PtaCodeLens 未导出，用 resolveCodeLens 的入参类型接收由本 provider 产出的 CodeLens */
type PtaCodeLensArgument = Parameters<typeof customCodeLensProvider.resolveCodeLens>[0];

/** 取出 CodeLens 解析后的命令（resolveCodeLens 可能同步返回，故统一 await） */
async function resolveCommands(codeLenses: vscode.CodeLens[]): Promise<NonNullable<vscode.Command>[]> {
    const commands: NonNullable<vscode.Command>[] = [];
    for (const codeLens of codeLenses) {
        const resolved = await customCodeLensProvider.resolveCodeLens(
            codeLens as PtaCodeLensArgument,
            {} as vscode.CancellationToken
        );
        commands.push((resolved as vscode.CodeLens).command as NonNullable<vscode.Command>);
    }
    return commands;
}

describe("CustomCodeLensProvider", () => {
    let getStateStub: sinon.SinonStub;
    let getActiveStub: sinon.SinonStub;

    beforeEach(() => {
        resetVscodeMock();
        // 计时按钮的文案依赖全局计时状态；默认没有任何活动计时器
        getStateStub = sinon.stub(timerManager, "getState").returns(TimerState.Idle);
        getActiveStub = sinon.stub(timerManager, "getActiveTimer").returns(undefined);
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    /** 取计时按钮解析后的命令 */
    async function resolveTimerCommand(source: string = createProblemSource()): Promise<vscode.Command> {
        const codeLenses = customCodeLensProvider.provideCodeLenses(createFakeDocument(source)) as vscode.CodeLens[];
        const commands = await resolveCommands(codeLenses);
        const command = commands.find((item) => item.command === "pintia.timerCodeLens");
        assert.ok(command, "未找到计时 CodeLens");
        return command;
    }

    it("未配置编辑器快捷键时不应提供任何 CodeLens", () => {
        setConfigValue("editor.shortcuts", []);

        const codeLenses = customCodeLensProvider.provideCodeLenses(createFakeDocument(createProblemSource()));

        assert.deepStrictEqual(codeLenses, []);
    });

    it("文件不含 PTA 文件头时应不提供 CodeLens", () => {
        setConfigValue("editor.shortcuts", ["Submit"]);

        assert.strictEqual(customCodeLensProvider.provideCodeLenses(createFakeDocument("int main() {}")), undefined);
    });

    it("有文件头但缺少 code=end 时不应提供 CodeLens", () => {
        setConfigValue("editor.shortcuts", ["Submit", "Test", "Preview"]);
        // 用户删掉围栏、或 snippet 只插了一半时就是这个状态：
        // 文件头在、code=end 不在，此前会产出 range 为 undefined 的透镜
        const source = [
            "// @pintia psid=ps1 pid=p1 compiler=GXX",
            "// @pintia code=start",
            "int main() { return 0; }",
        ].join("\n");

        assert.strictEqual(customCodeLensProvider.provideCodeLenses(createFakeDocument(source)), undefined);
    });

    it("应为每个快捷键与自定义样例各生成一个 CodeLens", () => {
        setConfigValue("editor.shortcuts", ["Submit", "Test", "Preview", "AddNote", "Timer"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: ["1 2", "3 4"] }))
        ) as vscode.CodeLens[];

        // 5 个快捷键 + 2 个自定义样例
        assert.strictEqual(codeLenses.length, 7);
    });

    it("应按配置中的顺序生成 CodeLens", async () => {
        setConfigValue("editor.shortcuts", ["Preview", "Submit", "Timer", "AddNote"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: [] }))
        ) as vscode.CodeLens[];
        const commands = await resolveCommands(codeLenses);

        assert.deepStrictEqual(
            commands.map((command) => command.command),
            ["pintia.previewProblem", "pintia.submitSolution", "pintia.timerCodeLens", "pintia.addNote"]
        );
        assert.strictEqual(commands[3].title, "Add Note");
    });

    it("配置中的重复快捷键应只生成一个 CodeLens", async () => {
        setConfigValue("editor.shortcuts", ["Submit", "Submit", "AddNote", "AddNote", "Timer", "Timer"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: [] }))
        ) as vscode.CodeLens[];
        const commands = await resolveCommands(codeLenses);

        assert.strictEqual(codeLenses.length, 3);
        assert.deepStrictEqual(
            commands.map((command) => command.command),
            ["pintia.submitSolution", "pintia.addNote", "pintia.timerCodeLens"]
        );
    });

    it("从配置中移除 AddNote 与 Timer 后不应再提供对应按钮", async () => {
        setConfigValue("editor.shortcuts", ["Submit"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: [] }))
        ) as vscode.CodeLens[];
        const commands = await resolveCommands(codeLenses);

        assert.deepStrictEqual(
            commands.map((command) => command.command),
            ["pintia.submitSolution"]
        );
    });

    it("解析后应绑定对应的命令与参数", async () => {
        setConfigValue("editor.shortcuts", ["Submit", "Test", "Preview"]);
        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ code: "int main() {}", customTests: ["1 2"] }))
        ) as vscode.CodeLens[];

        const commands = await resolveCommands(codeLenses);
        const byCommand = new Map(commands.map((command) => [command.command, command]));

        assert.deepStrictEqual([...byCommand.keys()].sort(), [
            "pintia.previewProblem",
            "pintia.submitSolution",
            "pintia.testCustomSample",
            "pintia.testSolution",
        ]);

        const submitCode = byCommand.get("pintia.submitSolution")?.arguments?.[0] as IPtaCode;
        assert.strictEqual(submitCode.psID, "ps1");
        assert.strictEqual(submitCode.pID, "p1");
        assert.strictEqual(submitCode.compiler, "GXX");
        assert.strictEqual(submitCode.code, "int main() {}");
        assert.deepStrictEqual(submitCode.customTests, ["1 2"]);

        assert.deepStrictEqual(byCommand.get("pintia.previewProblem")?.arguments, ["ps1", "p1", false, "codelens"]);
        assert.strictEqual(byCommand.get("pintia.testSolution")?.title, "Test");
    });

    describe("计时 CodeLens", () => {
        const namedSource = createProblemSource({
            header: [
                "/*",
                " * @pintia psid=ps1 pid=p1 compiler=GXX",
                " * ProblemSet: 期末考核",
                " * Title: 两数之和",
                " */",
            ].join("\n"),
        });

        function activeTimer(pID: string): IActiveTimer {
            return {
                psID: "ps1",
                pID,
                psName: "期末考核",
                title: "两数之和",
                startedAt: Date.now(),
                elapsedBeforeStart: 0,
            };
        }

        it("没有活动计时器时应显示「开始计时」，并带上题目信息", async () => {
            const command = await resolveTimerCommand(namedSource);

            assert.strictEqual(command.title, "Start Timing");
            assert.deepStrictEqual(command.arguments, [
                { psID: "ps1", pID: "p1", psName: "期末考核", title: "两数之和" },
            ]);
        });

        it("本题计时中应显示「暂停计时」", async () => {
            getStateStub.returns(TimerState.Running);
            getActiveStub.returns(activeTimer("p1"));

            const command = await resolveTimerCommand();

            assert.strictEqual(command.title, "Pause Timing");
        });

        it("本题已暂停应显示「继续计时」", async () => {
            getStateStub.returns(TimerState.Paused);
            getActiveStub.returns(activeTimer("p1"));

            const command = await resolveTimerCommand();

            assert.strictEqual(command.title, "Resume Timing");
        });

        it("另一题计时中应显示简短的「切换计时」", async () => {
            getActiveStub.returns(activeTimer("p2"));

            const command = await resolveTimerCommand();

            assert.strictEqual(command.title, "Switch Timing");
        });
    });

    it("自定义样例的标题应带序号，参数应带上样例下标", async () => {
        setConfigValue("editor.shortcuts", ["Submit"]);
        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: ["1 2", "3 4"] }))
        ) as vscode.CodeLens[];

        const commands = await resolveCommands(codeLenses);
        const customTestCommands = commands.filter((command) => command.command === "pintia.testCustomSample");

        assert.deepStrictEqual(
            customTestCommands.map((command) => command.title),
            ["Test custom sample 1", "Test custom sample 2"]
        );
        assert.deepStrictEqual(
            customTestCommands.map((command) => command.arguments?.[1]),
            [0, 1]
        );
    });

    it("默认配置下添加笔记应位于 Preview 右侧、计时按钮左侧", async () => {
        setConfigValue("editor.shortcuts", ["Submit", "Test", "Preview", "AddNote", "Timer"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: [] }))
        ) as vscode.CodeLens[];
        const commands = await resolveCommands(codeLenses);

        assert.deepStrictEqual(
            commands.map((command) => command.command),
            [
                "pintia.submitSolution",
                "pintia.testSolution",
                "pintia.previewProblem",
                "pintia.addNote",
                "pintia.timerCodeLens",
            ]
        );
        assert.strictEqual(commands[3].title, "Add Note");
    });

    it("笔记块应提供格式化 CodeLens（不受 editor.shortcuts 影响）", async () => {
        setConfigValue("editor.shortcuts", []);
        const source =
            createProblemSource({ customTests: [] }) + "\n/* @pintia note=start\n## 标题\n@pintia note=end */";

        const codeLenses = customCodeLensProvider.provideCodeLenses(createFakeDocument(source)) as vscode.CodeLens[];
        const commands = await resolveCommands(codeLenses);
        const noteCommand = commands.find((command) => command.command === "pintia.formatNote");

        assert.ok(noteCommand, "未找到格式化笔记 CodeLens");
        assert.strictEqual(noteCommand.title, "Format Note");
        // AddNote 已从配置中移除，不应再渲染添加按钮
        assert.ok(
            !commands.some((command) => command.command === "pintia.addNote"),
            "未配置 AddNote 时不应提供添加笔记 CodeLens"
        );
    });
});
