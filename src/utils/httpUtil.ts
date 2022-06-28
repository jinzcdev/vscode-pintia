import fetch from "node-fetch";

export async function httpGet(url: string, cookie: string = ''): Promise<any> {
    return await fetch(url, {
        method: "GET",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookie
        }
    })
        .then(response => response.json())
        .catch(reason => console.log(reason));
}

export async function httpPost(url: string, cookie: string = '', body: any): Promise<any> {
    return await fetch(url, {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify(body)
    })
        .then(response => response.json())
        .catch(reason => console.log(reason));  
}

// async function http(url:string, method: string, cookie: string = '', body: any): Promise<any> {
//     return fetch(url, {
//         method: "POST",
//         headers: {
//             'Accept': 'application/json',
//             'Content-Type': 'application/json',
//             'Cookie': cookie
//         },
//         body: JSON.stringify(body)
//     })
// }