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

    it("未配置编辑器快捷键时仍应提供计时 CodeLens", async () => {
        setConfigValue("editor.shortcuts", []);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource())
        ) as vscode.CodeLens[];

        assert.strictEqual(codeLenses.length, 1);
        const command = await resolveCommands(codeLenses);
        assert.deepStrictEqual(
            command.map((item) => item.command),
            ["pintia.timerCodeLens"]
        );
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

    it("应为每个快捷键与自定义样例生成 CodeLens，计时按钮排在最后", async () => {
        setConfigValue("editor.shortcuts", ["Submit", "Test", "Preview"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: ["1 2", "3 4"] }))
        ) as vscode.CodeLens[];

        // 3 个快捷键 + 2 个自定义样例 + 1 个计时按钮
        assert.strictEqual(codeLenses.length, 6);
        const commands = await resolveCommands(codeLenses);
        assert.strictEqual(
            commands[commands.length - 1].command,
            "pintia.timerCodeLens",
            "计时按钮应排在最后，显示在同行最右侧"
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
            "pintia.timerCodeLens",
        ]);

        const submitCode = byCommand.get("pintia.submitSolution")?.arguments?.[0] as IPtaCode;
        assert.strictEqual(submitCode.psID, "ps1");
        assert.strictEqual(submitCode.pID, "p1");
        assert.strictEqual(submitCode.compiler, "GXX");
        assert.strictEqual(submitCode.code, "int main() {}");
        assert.deepStrictEqual(submitCode.customTests, ["1 2"]);

        assert.deepStrictEqual(byCommand.get("pintia.previewProblem")?.arguments, ["ps1", "p1", false]);
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
});
