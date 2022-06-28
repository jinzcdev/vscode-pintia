import { IPtaUser } from "./PtaUser";

enum AuthStatus {
    WAITING = "WAITING",
    SUCCESSFUL = "SUCCESSFUL",
    FAILURE = "FAILURE"
}

export interface IWechatAuth {
    url: string;
    state: string;
}

export interface IWechatAuthState {
    status: AuthStatus;
}

export interface IWechatUserState {
    id: string;
    nickname: string;
}

export interface IWechatUserInfo {
    user: IPtaUser;
    requireSms: boolean;
    mfa: [];
    // add `cookie` property.
    cookie: string;
}