import { PtaLoginMethod } from "../shared";
import { accountAuthProvider } from "./accountAuthProvider";
import { IUserAuthProvider } from "./IUserAuthProvider";
import { ptaCookieAuthProvider } from "./ptaCookieAuthProvider";
import { weChatAuthProvider } from "./weChatAuthProvider";

export class UserAuthProviderFactory {
    public static createUserAuthProvider(loginMethod: PtaLoginMethod): IUserAuthProvider {
        switch (loginMethod) {
            case PtaLoginMethod.WeChat:
                return weChatAuthProvider;
            case PtaLoginMethod.PTA:
                return accountAuthProvider;
            case PtaLoginMethod.Cookie:
                return ptaCookieAuthProvider;
            default:
                throw new Error(`Unsupported login method: ${loginMethod}`);
        }
    }
}