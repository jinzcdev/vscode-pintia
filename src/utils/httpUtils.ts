import * as vscode from "vscode";
import fetch from "node-fetch";
import { ptaChannel } from "../ptaChannel";
import { getSession } from "../sessionStore";
import { delay } from "./polling";
import { DialogType, promptForOpenOutputChannel } from "./uiUtils";

/**
 * 可选的限流重试策略。
 *
 * 默认不启用：普通请求的行为保持不变，只有批量测试这类明确知道可以重试的
 * 调用方才会传入。默认只重试 429，避免 POST 在 503/超时等不确定状态下重复提交。
 */
export interface IHttpRetryPolicy {
    /** 最大重试次数（不含首次请求） */
    retries: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterMs?: number;
    retryStatusCodes?: number[];
    /** 是否采用服务端 Retry-After 头，默认 true */
    respectRetryAfter?: boolean;
    /** 可注入的等待实现，便于测试 */
    sleep?: (ms: number) => Promise<void>;
}

/** HTTP 请求可选配置 */
export interface HttpRequestOptions {
    /** 不弹出错误对话框的状态码（如 403 无权限） */
    silentStatusCodes?: number[];
    /** 限流重试策略；不传时完全不重试 */
    retry?: IHttpRetryPolicy;
}

/** 带 HTTP 状态码的请求错误 */
export class HttpRequestError extends Error {
    public readonly status: number;
    public readonly retryAfterMs?: number;

    constructor(status: number, retryAfterMs?: number) {
        super(`HTTP error! status: ${status}`);
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}

/** 判断是否应向用户展示 HTTP 错误对话框（供单元测试使用） */
export function shouldShowHttpError(error: unknown, options?: HttpRequestOptions): boolean {
    if (error instanceof HttpRequestError && options?.silentStatusCodes?.includes(error.status)) {
        return false;
    }
    return true;
}

/** 解析 Retry-After：支持秒数与 HTTP-date */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
    if (!value) {
        return undefined;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
        return Math.max(0, seconds * 1000);
    }
    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
        return Math.max(0, date - now);
    }
    return undefined;
}

async function fetchJson(url: string, init: fetch.RequestInit): Promise<any> {
    const response = await fetch(url, init);
    if (!response.ok && response.status !== 412) {
        throw new HttpRequestError(response.status, parseRetryAfter(response.headers?.get?.("retry-after")));
    }
    return response.json();
}

async function requestJsonWithRetry(
    url: string,
    init: fetch.RequestInit,
    options?: HttpRequestOptions,
    label: string = ""
): Promise<any> {
    const policy = options?.retry;
    const retries = policy?.retries ?? 0;
    const retryStatusCodes = policy?.retryStatusCodes ?? [429];
    const baseDelayMs = policy?.baseDelayMs ?? 1000;
    const maxDelayMs = policy?.maxDelayMs ?? 15000;
    const jitterMs = policy?.jitterMs ?? 250;
    const sleep = policy?.sleep ?? delay;

    for (let attempt = 0; ; attempt++) {
        try {
            return await fetchJson(url, init);
        } catch (error) {
            const retryable =
                error instanceof HttpRequestError && retryStatusCodes.includes(error.status) && attempt < retries;
            if (!retryable) {
                throw error;
            }

            const retryAfterMs = policy?.respectRetryAfter !== false ? error.retryAfterMs : undefined;
            const backoffMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * jitterMs;
            const waitMs = Math.min(maxDelayMs, Math.max(retryAfterMs ?? 0, backoffMs));
            ptaChannel.warn(
                `[HTTP ${label}] ${url} returned ${(error as HttpRequestError).status}, retry ${
                    attempt + 1
                }/${retries} after ${Math.round(waitMs)}ms`
            );
            await sleep(waitMs);
        }
    }
}

export async function httpGet(url: string, cookie: string = "", options?: HttpRequestOptions): Promise<any> {
    const json = await requestJsonWithRetry(
        url,
        {
            method: "GET",
            headers: {
                Accept: "application/json;charset=UTF-8",
                "Content-Type": "application/json;charset=UTF-8",
                "Accept-Language": "zh-CN",
                Cookie: !cookie ? (getSession()?.cookie ?? "") : cookie,
            },
        },
        options,
        "Get"
    ).catch((error) => {
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
    const json = await requestJsonWithRetry(
        url,
        {
            method: "POST",
            headers: {
                Accept: "application/json;charset=UTF-8",
                "Content-Type": "application/json;charset=UTF-8",
                "Accept-Language": "zh-CN",
                Cookie: !cookie ? (getSession()?.cookie ?? "") : cookie,
            },
            body: JSON.stringify(body),
        },
        options,
        "Post"
    ).catch((error) => {
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
