import * as assert from "assert";
import { getSession, setSession } from "../../src/sessionStore";
import { IUserSession } from "../../src/entity/userLoginSession";

/**
 * sessionStore 是解环的枢纽：ptaManager 写、httpUtils/ptaApi 读。
 * 它只是模块级状态，因此这里只锁住读写与清空语义。
 */
describe("sessionStore", () => {
    beforeEach(() => {
        setSession(undefined);
    });

    afterEach(() => {
        setSession(undefined);
    });

    it("清空后应返回 undefined", () => {
        assert.strictEqual(getSession(), undefined);
    });

    it("写入后应能读回同一个会话对象", () => {
        const session = { cookie: "PTASession=x", id: "u1", user: "nickname" } as IUserSession;

        setSession(session);

        assert.strictEqual(getSession(), session);
        assert.strictEqual(getSession()?.cookie, "PTASession=x");
    });

    it("再次写入 undefined 应清空会话", () => {
        setSession({ cookie: "PTASession=x" } as IUserSession);

        setSession(undefined);

        assert.strictEqual(getSession(), undefined);
    });

    it("切换账号时读取方应看到新会话", () => {
        setSession({ cookie: "PTASession=a" } as IUserSession);
        assert.strictEqual(getSession()?.cookie, "PTASession=a");

        setSession({ cookie: "PTASession=b" } as IUserSession);
        assert.strictEqual(getSession()?.cookie, "PTASession=b");
    });
});
