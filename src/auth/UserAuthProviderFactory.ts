import { PtaLoginMethod } from "../shared";
import { accountAuthProvider } from "./accountAuthProvider";
import { IUserAuthProvider } from "./IUserAuthProvider";
import { weChatAuthProvider } from "./weChatAuthProvider";

export class UserAuthProviderFactory {
    public static createUserAuthProvider(loginMethod: PtaLoginMethod): IUserAuthProvider {
        switch (loginMethod) {
            case PtaLoginMethod.WeChat:
                return weChatAuthProvider;
            case PtaLoginMethod.PTA:
                return accountAuthProvider;
            default:
                throw new Error(`Unsupported login method: ${loginMethod}`);
        }
    }
}