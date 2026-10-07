import * as assert from "assert";
import { accountAuthProvider } from "../../../src/auth/accountAuthProvider";
import { ptaCookieAuthProvider } from "../../../src/auth/ptaCookieAuthProvider";
import { UserAuthProviderFactory } from "../../../src/auth/UserAuthProviderFactory";
import { weChatAuthProvider } from "../../../src/auth/weChatAuthProvider";
import { PtaLoginMethod } from "../../../src/shared";

describe("UserAuthProviderFactory", () => {
    it("微信登录应返回微信扫码 provider", () => {
        assert.strictEqual(UserAuthProviderFactory.createUserAuthProvider(PtaLoginMethod.WeChat), weChatAuthProvider);
    });

    it("账号登录应返回账号 provider", () => {
        assert.strictEqual(UserAuthProviderFactory.createUserAuthProvider(PtaLoginMethod.PTA), accountAuthProvider);
    });

    it("Cookie 登录应返回 Cookie provider", () => {
        assert.strictEqual(
            UserAuthProviderFactory.createUserAuthProvider(PtaLoginMethod.Cookie),
            ptaCookieAuthProvider
        );
    });

    it("不支持的登录方式应抛错", () => {
        assert.throws(
            () => UserAuthProviderFactory.createUserAuthProvider("Unsupported" as PtaLoginMethod),
            /Unsupported login method/
        );
    });

    it("账号 provider 尚未实现，调用应抛错", () => {
        assert.throws(() => accountAuthProvider.signIn(), /not implemented/);
        assert.throws(() => accountAuthProvider.signOut(), /not implemented/);
    });
});
