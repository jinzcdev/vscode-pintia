import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { weChatAuthProvider } from "../../../src/auth/weChatAuthProvider";
import { AuthStatus } from "../../../src/entity/userLoginSession";
import { ptaApi } from "../../../src/utils/api";
import { PtaLoginProvider } from "../../../src/webview/PtaLoginProvider";
import { resetVscodeMock } from "../../setup";

/**
 * 回归背景：扫码登录用 `setInterval(async ...)` 轮询，而抛错既不会结束等待、
 * 也走不到收尾逻辑；计数又只在成功分支之前递增，一旦抛错就永远到不了上限。
 *
 * 实测触发场景：用一个从未注册过拼题A 的微信账号扫码，
 * `/wechat/state/{state}/user` 返回 `{}`，代码拿着 `undefined` 去请求
 * `login_users/undefined` 并抛错 → 轮询永不停止，「正在登录」的提示 3 分钟不消失。
 */
describe("weChatAuthProvider - 扫码登录的终止性", () => {
    /** 只实现被测代码所需方法的登录面板 */
    function createFakeLoginProvider() {
        let onDispose: (() => void) | undefined;
        return {
            show: sinon.stub().resolves(),
            dispose: sinon.stub().callsFake(() => onDispose?.()),
            onDidDisposeCallBack: sinon.stub().callsFake((cb: () => void) => {
                onDispose = cb;
            }),
            /** 模拟用户手动关闭面板 */
            closeByUser: () => onDispose?.(),
        };
    }

    let panel: ReturnType<typeof createFakeLoginProvider>;
    let clock: sinon.SinonFakeTimers;
    let errorStub: sinon.SinonStub;

    /** 推进 n 个轮询间隔 */
    async function tick(times: number): Promise<void> {
        for (let i = 0; i < times; i++) {
            await clock.tickAsync(2000);
        }
    }

    beforeEach(() => {
        resetVscodeMock();
        clock = sinon.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        panel = createFakeLoginProvider();
        sinon.stub(PtaLoginProvider, "createOrUpdate").returns(panel as never);
        sinon.stub(ptaApi, "getWechatAuth").resolves({ url: "https://qr", state: "STATE" } as never);
        errorStub = vscode.window.showErrorMessage as sinon.SinonStub;
    });

    afterEach(() => {
        sinon.restore();
        resetVscodeMock();
    });

    it("微信号未绑定拼题A 账号时应收尾、提示，且不再请求 login_users", async () => {
        sinon.stub(ptaApi, "getWechatAuthState").resolves({ status: AuthStatus.SUCCESSFUL } as never);
        // 未绑定时该接口返回空对象
        sinon.stub(ptaApi, "getWechatAuthUser").resolves({} as never);
        const userInfoStub = sinon.stub(ptaApi, "getWechatUserInfo");

        const promise = weChatAuthProvider.signIn();
        await tick(1);
        const session = await promise;

        assert.strictEqual(session, undefined);
        assert.strictEqual(userInfoStub.called, false, "不应拿着 undefined 的 id 去换会话");
        assert.strictEqual(panel.dispose.called, true, "必须关掉面板，否则等待永不结束");
        assert.strictEqual(errorStub.calledOnce, true);
        assert.ok(
            String(errorStub.firstCall.args[0]).includes("not bound"),
            `提示文案应说明未绑定，实际: ${errorStub.firstCall.args[0]}`
        );
    });

    it("换会话接口抛错时仍应收尾，不会卡住等待", async () => {
        sinon.stub(ptaApi, "getWechatAuthState").resolves({ status: AuthStatus.SUCCESSFUL } as never);
        sinon.stub(ptaApi, "getWechatAuthUser").resolves({ id: "u1" } as never);
        sinon.stub(ptaApi, "getWechatUserInfo").rejects(new Error("boom"));

        const promise = weChatAuthProvider.signIn();
        // 第一次抛错后仍会继续轮询，直到次数上限
        await tick(60);
        const session = await promise;

        assert.strictEqual(session, undefined);
        assert.strictEqual(panel.dispose.called, true, "抛错也必须走到收尾");
    });

    it("扫码成功时应返回会话并关闭面板", async () => {
        sinon.stub(ptaApi, "getWechatAuthState").resolves({ status: AuthStatus.SUCCESSFUL } as never);
        sinon.stub(ptaApi, "getWechatAuthUser").resolves({ id: "u1" } as never);
        sinon.stub(ptaApi, "getWechatUserInfo").resolves({
            user: { id: "u1", nickname: "nick", email: "a@b.c" },
            cookie: "PTASession=abc;",
        } as never);

        const promise = weChatAuthProvider.signIn();
        await tick(1);
        const session = await promise;

        assert.strictEqual(session?.id, "u1");
        assert.strictEqual(session?.cookie, "PTASession=abc;");
        assert.strictEqual(session?.loginMethod, "WeChat");
        assert.strictEqual(panel.dispose.called, true);
    });

    it("状态一直为 WAITING 时应在上限处收尾", async () => {
        sinon.stub(ptaApi, "getWechatAuthState").resolves({ status: AuthStatus.WAITING } as never);

        const promise = weChatAuthProvider.signIn();
        await tick(60);
        const session = await promise;

        assert.strictEqual(session, undefined);
        assert.strictEqual(panel.dispose.called, true, "超时后必须关掉面板");
    });

    it("用户关闭面板时应立即结束等待且不再轮询", async () => {
        const stateStub = sinon.stub(ptaApi, "getWechatAuthState").resolves({ status: AuthStatus.WAITING } as never);

        const promise = weChatAuthProvider.signIn();
        // 先让 signIn 里的 await 链跑完，否则 onDidDisposeCallBack 还没注册上
        await clock.tickAsync(0);
        panel.closeByUser();
        const session = await promise;

        assert.strictEqual(session, undefined);
        assert.strictEqual(stateStub.called, false, "用户已取消，不应再请求扫码状态");
    });

    it("扫码成功后不应重复关闭面板", async () => {
        sinon.stub(ptaApi, "getWechatAuthState").resolves({ status: AuthStatus.SUCCESSFUL } as never);
        sinon.stub(ptaApi, "getWechatAuthUser").resolves({ id: "u1" } as never);
        sinon.stub(ptaApi, "getWechatUserInfo").resolves({
            user: { id: "u1", nickname: "nick", email: "a@b.c" },
            cookie: "PTASession=abc;",
        } as never);

        const promise = weChatAuthProvider.signIn();
        await tick(1);
        await promise;

        assert.strictEqual(panel.dispose.callCount, 1);
    });
});
