import * as vscode from "vscode";
import fetch from "node-fetch";
import { ptaChannel } from "../ptaChannel";
import { ptaManager } from "../ptaManager";
import { DialogType, promptForOpenOutputChannel } from "./uiUtils";

/** HTTP 请求可选配置 */
export interface HttpRequestOptions {
    /** 不弹出错误对话框的状态码（如 403 无权限） */
    silentStatusCodes?: number[];
}

/** 带 HTTP 状态码的请求错误 */
export class HttpRequestError extends Error {
    public readonly status: number;

    constructor(status: number) {
        super(`HTTP error! status: ${status}`);
        this.status = status;
    }
}

/** 判断是否应向用户展示 HTTP 错误对话框（供单元测试使用） */
export function shouldShowHttpError(error: unknown, options?: HttpRequestOptions): boolean {
    if (error instanceof HttpRequestError && options?.silentStatusCodes?.includes(error.status)) {
        return false;
    }
    return true;
}

export async function httpGet(url: string, cookie: string = "", options?: HttpRequestOptions): Promise<any> {
    const json = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json;charset=UTF-8",
            "Content-Type": "application/json;charset=UTF-8",
            "Accept-Language": "zh-CN",
            Cookie: !cookie ? (ptaManager.getUserSession()?.cookie ?? "") : cookie,
        },
    })
        .then((response) => {
            if (!response.ok && response.status !== 412) {
                throw new HttpRequestError(response.status);
            }
            return response.json();
        })
        .catch((error) => {
            ptaChannel.error(error);
            if (shouldShowHttpError(error, options)) {
                promptForOpenOutputChannel(
                    vscode.l10n.t("API request failed. Please check the output channel for details."),
                    DialogType.error
                );
            }
        });
    ptaChannel.info(`[HTTP Get - Request] ${url}`);
    ptaChannel.info(`[HTTP Get - Response] ${JSON.stringify(json)}`);
    return json;
}

export async function httpPost(
    url: string,
    cookie: string = "",
    body?: any,
    options?: HttpRequestOptions
): Promise<any> {
    const json = await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json;charset=UTF-8",
            "Content-Type": "application/json;charset=UTF-8",
            "Accept-Language": "zh-CN",
            Cookie: !cookie ? (ptaManager.getUserSession()?.cookie ?? "") : cookie,
        },
        body: JSON.stringify(body),
    })
        .then((response) => {
            if (!response.ok && response.status !== 412) {
                throw new HttpRequestError(response.status);
            }
            return response.json();
        })
        .catch((error) => {
            ptaChannel.error(error);
            if (shouldShowHttpError(error, options)) {
                promptForOpenOutputChannel(
                    vscode.l10n.t("API request failed. Please check the output channel for details."),
                    DialogType.error
                );
            }
        });
    ptaChannel.info(`[HTTP Post - Request] ${url}\n${JSON.stringify(body)}`);
    ptaChannel.info(`[HTTP Post - Response] ${JSON.stringify(json)}`);
    return json;
}

export function addUrlParams(url: string, params: any): string {
    const urlObj = new URL(url);
    for (const key in params) {
        urlObj.searchParams.append(key, params[key]);
    }
    return urlObj.toString();
}
