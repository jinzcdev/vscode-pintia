import * as assert from "assert";
import * as sinon from "sinon";
import fetch from "node-fetch";
import {
    HttpRequestError,
    httpGet,
    httpPost,
    parseRetryAfter,
    shouldShowHttpError,
} from "../../../src/utils/httpUtils";
import * as uiUtils from "../../../src/utils/uiUtils";
import { setSession } from "../../../src/sessionStore";

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

        beforeEach(() => {
            fetchStub = sinon.stub(fetch as unknown as { default: typeof fetch }, "default" as never);
            promptStub = sinon.stub(uiUtils, "promptForOpenOutputChannel").resolves();
            setSession(undefined);
        });

        afterEach(() => {
            sinon.restore();
            setSession(undefined);
        });

        /** 取出发出的 Cookie 请求头 */
        function sentCookie(): string {
            return (fetchStub.firstCall.args[1] as { headers: Record<string, string> }).headers.Cookie;
        }

        /** 构造 fetch 响应 mock */
        function mockResponse(status: number, body: unknown = {}, retryAfter?: string): void {
            fetchStub.resolves({
                ok: status >= 200 && status < 300,
                status,
                headers: {
                    get: (name: string) => (name.toLowerCase() === "retry-after" ? (retryAfter ?? null) : null),
                },
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
            assert.strictEqual(sentCookie(), "cookie=test");
        });

        it("未传 cookie 时应回退到当前会话", async () => {
            mockResponse(200, {});
            setSession({ cookie: "PTASession=session" } as never);

            await httpGet("https://pintia.cn/api/test");

            assert.strictEqual(sentCookie(), "PTASession=session");
        });

        it("传入 cookie 时应优先于会话", async () => {
            mockResponse(200, {});
            setSession({ cookie: "PTASession=session" } as never);

            await httpGet("https://pintia.cn/api/test", "PTASession=param");

            assert.strictEqual(sentCookie(), "PTASession=param");
        });
    });

    describe("429 限流重试", () => {
        let fetchStub: sinon.SinonStub;
        let promptStub: sinon.SinonStub;
        let sleep: sinon.SinonStub;

        beforeEach(() => {
            fetchStub = sinon.stub(fetch as unknown as { default: typeof fetch }, "default" as never);
            promptStub = sinon.stub(uiUtils, "promptForOpenOutputChannel").resolves();
            sleep = sinon.stub().resolves();
            responseIndex = 0;
            setSession(undefined);
        });

        afterEach(() => {
            sinon.restore();
            setSession(undefined);
        });

        let responseIndex = 0;
        function respond(status: number, body: unknown = {}, retryAfter?: string): void {
            fetchStub.onCall(responseIndex++).resolves({
                ok: status >= 200 && status < 300,
                status,
                headers: {
                    get: (name: string) => (name.toLowerCase() === "retry-after" ? (retryAfter ?? null) : null),
                },
                json: async () => body,
            });
        }

        it("未配置 retry 时 429 不应重试", async () => {
            respond(429);

            const result = await httpGet("https://pintia.cn/api/test");

            assert.strictEqual(result, undefined);
            assert.strictEqual(fetchStub.callCount, 1);
            assert.strictEqual(promptStub.calledOnce, true);
        });

        it("429 后应重试并返回成功结果", async () => {
            respond(429);
            respond(200, { ok: true });

            const result = await httpGet("https://pintia.cn/api/test", "", {
                retry: { retries: 1, baseDelayMs: 0, jitterMs: 0, sleep },
            });

            assert.deepStrictEqual(result, { ok: true });
            assert.strictEqual(fetchStub.callCount, 2);
            assert.strictEqual(sleep.calledOnce, true);
            assert.strictEqual(promptStub.called, false);
        });

        it("应优先使用 Retry-After 头", async () => {
            respond(429, {}, "2");
            respond(200, {});

            await httpGet("https://pintia.cn/api/test", "", {
                retry: { retries: 1, baseDelayMs: 0, jitterMs: 0, sleep },
            });

            assert.strictEqual(sleep.calledWith(2000), true);
        });

        it("重试耗尽后应只弹一次错误对话框", async () => {
            respond(429);
            respond(429);

            const result = await httpGet("https://pintia.cn/api/test", "", {
                retry: { retries: 1, baseDelayMs: 0, jitterMs: 0, sleep },
            });

            assert.strictEqual(result, undefined);
            assert.strictEqual(fetchStub.callCount, 2);
            assert.strictEqual(promptStub.calledOnce, true);
        });

        it("POST 同样支持 429 重试", async () => {
            respond(429);
            respond(200, { submissionId: "s1" });

            const result = await httpPost(
                "https://pintia.cn/api/exams/e/submissions",
                "c",
                { a: 1 },
                {
                    retry: { retries: 1, baseDelayMs: 0, jitterMs: 0, sleep },
                }
            );

            assert.deepStrictEqual(result, { submissionId: "s1" });
            assert.strictEqual(fetchStub.callCount, 2);
        });
    });

    describe("parseRetryAfter", () => {
        it("应支持秒数", () => {
            assert.strictEqual(parseRetryAfter("2"), 2000);
        });

        it("应支持 HTTP-date", () => {
            const now = Date.parse("2026-01-01T00:00:00Z");
            assert.strictEqual(parseRetryAfter("Thu, 01 Jan 2026 00:00:05 GMT", now), 5000);
        });

        it("无法解析时应返回 undefined", () => {
            assert.strictEqual(parseRetryAfter("not-a-date"), undefined);
            assert.strictEqual(parseRetryAfter(undefined), undefined);
        });
    });
});
