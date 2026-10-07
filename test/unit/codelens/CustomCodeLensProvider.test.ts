import * as assert from "assert";
import * as vscode from "vscode";
import { customCodeLensProvider } from "../../../src/codelens/CustomCodeLensProvider";
import { IPtaCode } from "../../../src/shared";
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
    beforeEach(() => {
        resetVscodeMock();
    });

    afterEach(() => {
        resetVscodeMock();
    });

    it("未配置编辑器快捷键时应不提供 CodeLens", () => {
        setConfigValue("editor.shortcuts", []);

        assert.strictEqual(
            customCodeLensProvider.provideCodeLenses(createFakeDocument(createProblemSource())),
            undefined
        );
    });

    it("文件不含 PTA 文件头时应不提供 CodeLens", () => {
        setConfigValue("editor.shortcuts", ["Submit"]);

        assert.strictEqual(customCodeLensProvider.provideCodeLenses(createFakeDocument("int main() {}")), undefined);
    });

    it("应为每个快捷键与自定义样例生成 CodeLens", () => {
        setConfigValue("editor.shortcuts", ["Submit", "Test", "Preview"]);

        const codeLenses = customCodeLensProvider.provideCodeLenses(
            createFakeDocument(createProblemSource({ customTests: ["1 2", "3 4"] }))
        ) as vscode.CodeLens[];

        // 3 个快捷键 + 2 个自定义样例
        assert.strictEqual(codeLenses.length, 5);
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

        assert.deepStrictEqual(byCommand.get("pintia.previewProblem")?.arguments, ["ps1", "p1", false]);
        assert.strictEqual(byCommand.get("pintia.testSolution")?.title, "Test");
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
