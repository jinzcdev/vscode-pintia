import * as assert from "assert";
import * as sinon from "sinon";
import { changeWorkspaceFolder } from "../../../src/commands/workspace";
import { ptaConfig } from "../../../src/ptaConfig";
import * as uiUtils from "../../../src/utils/uiUtils";
import { resetVscodeMock } from "../../setup";

describe("commands/workspace - changeWorkspaceFolder", () => {
    beforeEach(() => {
        resetVscodeMock();
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("应写入 Uri.fsPath 而不是 Uri.path", async () => {
        // Windows 上两者不同：path 是 "/c:/codes"，fsPath 是 "C:\\codes"。
        // 写错会让后续的 fs.ensureDir / path.join 拿到非法路径。
        const uri = { fsPath: "C:\\codes", path: "/c:/codes" };
        sinon.stub(uiUtils, "showDirectorySelectDialog").resolves([uri as never]);
        const updateStub = sinon.stub(ptaConfig, "update").resolves();

        await changeWorkspaceFolder();

        assert.strictEqual(updateStub.calledOnce, true);
        assert.deepStrictEqual(updateStub.firstCall.args, ["workspaceFolder", "C:\\codes"]);
    });

    it("用户取消选择时不应写入任何配置", async () => {
        sinon.stub(uiUtils, "showDirectorySelectDialog").resolves(undefined);
        const updateStub = sinon.stub(ptaConfig, "update").resolves();

        await changeWorkspaceFolder();

        assert.strictEqual(updateStub.called, false);
    });

    it("选择了空数组时不应写入任何配置", async () => {
        sinon.stub(uiUtils, "showDirectorySelectDialog").resolves([]);
        const updateStub = sinon.stub(ptaConfig, "update").resolves();

        await changeWorkspaceFolder();

        assert.strictEqual(updateStub.called, false);
    });
});
