import { PtaLoginMethod } from "../shared";
import { IPtaUser } from "./PtaUser";

export enum AuthStatus {
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

export interface IUserSession {
    id: string,
    user: string,
    email: string,
    loginMethod: PtaLoginMethod,
    cookie: string
}