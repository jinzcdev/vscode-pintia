import * as assert from "assert";
import * as sinon from "sinon";
import fetch from "node-fetch";
import { HttpRequestError, httpGet, shouldShowHttpError } from "../../src/utils/httpUtils";
import * as uiUtils from "../../src/utils/uiUtils";
import { ptaManager } from "../../src/ptaManager";

describe("httpUtils", () => {
    describe("shouldShowHttpError", () => {
        it("403 在 silentStatusCodes 中时不弹窗", () => {
            const error = new HttpRequestError(403);
            assert.strictEqual(shouldShowHttpError(error, { silentStatusCodes: [403] }), false);
        });

        it("403 不在 silentStatusCodes 中时应弹窗", () => {
            const error = new HttpRequestError(403);
            assert.strictEqual(shouldShowHttpError(error, { silentStatusCodes: [404] }), true);
        });

        it("非 HttpRequestError 时应弹窗", () => {
            assert.strictEqual(shouldShowHttpError(new Error("network")), true);
        });
    });

    describe("httpGet", () => {
        let fetchStub: sinon.SinonStub;
        let promptStub: sinon.SinonStub;
        let sessionStub: sinon.SinonStub;

        beforeEach(() => {
            fetchStub = sinon.stub(fetch as unknown as { default: typeof fetch }, "default" as never);
            promptStub = sinon.stub(uiUtils, "promptForOpenOutputChannel").resolves();
            sessionStub = sinon.stub(ptaManager, "getUserSession").returns(undefined);
        });

        afterEach(() => {
            sinon.restore();
        });

        /** 构造 fetch 响应 mock */
        function mockResponse(status: number, body: unknown = {}): void {
            fetchStub.resolves({
                ok: status >= 200 && status < 300,
                status,
                json: async () => body,
            });
        }

        it("403 且配置 silentStatusCodes 时不弹出错误对话框", async () => {
            mockResponse(403);

            const result = await httpGet("https://pintia.cn/api/test", "", { silentStatusCodes: [403] });

            assert.strictEqual(result, undefined);
            assert.strictEqual(promptStub.called, false);
        });

        it("500 错误时仍弹出错误对话框", async () => {
            mockResponse(500);

            const result = await httpGet("https://pintia.cn/api/test");

            assert.strictEqual(result, undefined);
            assert.strictEqual(promptStub.calledOnce, true);
        });

        it("请求成功时返回 JSON 数据", async () => {
            mockResponse(200, { summaries: { PROGRAMMING: { total: 3 } } });

            const result = await httpGet("https://pintia.cn/api/test", "cookie=test");

            assert.deepStrictEqual(result, { summaries: { PROGRAMMING: { total: 3 } } });
            assert.strictEqual(promptStub.called, false);
            assert.strictEqual(sessionStub.called, false);
        });
    });
});
