import fetch from "node-fetch";
import { ptaChannel } from "../ptaChannel";

export async function httpGet(url: string, cookie: string = ''): Promise<any> {
    const json = await fetch(url, {
        method: "GET",
        headers: {
            'Accept': 'application/json;charset=UTF-8',
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept-Language': 'zh-CN',
            'Cookie': cookie
        }
    })
        .then(response => response.json());
    ptaChannel.appendLine(`[HTTP Get] ${url}`);
    return json;
}

export async function httpPost(url: string, cookie: string = '', body?: any): Promise<any> {
    const json = await fetch(url, {
        method: "POST",
        headers: {
            'Accept': 'application/json;charset=UTF-8',
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept-Language': 'zh-CN',
            'Cookie': cookie
        },
        body: JSON.stringify(body)
    })
        .then(response => response.json());
    ptaChannel.appendLine(`[HTTP Post] ${url}`);
    ptaChannel.appendLine(JSON.stringify(body ?? ""));
    return json;
}
