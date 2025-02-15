import fetch from "node-fetch";
import { ptaChannel } from "../ptaChannel";
import { ptaManager } from "../ptaManager";

export async function httpGet(url: string, cookie: string = ''): Promise<any> {
    const json = await fetch(url, {
        method: "GET",
        headers: {
            'Accept': 'application/json;charset=UTF-8',
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept-Language': 'zh-CN',
            'Cookie': !cookie ? ptaManager.getUserSession()?.cookie ?? '' : cookie
        }
    })
        .then(response => response.json());
    ptaChannel.info(`[HTTP Get - Request] ${url}`);
    ptaChannel.info(`[HTTP Get - Response] ${JSON.stringify(json)}`);
    return json;
}

export async function httpPost(url: string, cookie: string = '', body?: any): Promise<any> {
    const json = await fetch(url, {
        method: "POST",
        headers: {
            'Accept': 'application/json;charset=UTF-8',
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept-Language': 'zh-CN',
            'Cookie': !cookie ? ptaManager.getUserSession()?.cookie ?? '' : cookie
        },
        body: JSON.stringify(body)
    })
        .then(response => response.json());
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
