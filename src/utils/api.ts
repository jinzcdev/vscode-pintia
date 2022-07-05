import { IProblemSet } from "../entity/ProblemSet";
import { IProblemInfo } from "../entity/ProblemInfo";
import { ProblemType } from "../shared";
import { httpGet, httpPost } from "./httpUtil";
import { IProblem } from "../entity/Problem";
import { IProblemSummary } from "../entity/ProblemSummary";
import { IProblemSetExam } from "../entity/ProblemSetExam";
import { IProblemCode } from "../entity/ProblemSubmissionCode";
import { IProblemSubmission } from "../entity/ProblemSubmission";
import { IProblemSubmissionResult } from "../entity/ProblemSubmissionResult";

import { configPath } from "../shared";
import { IWechatAuth, IWechatAuthState, IWechatUserInfo, IWechatUserState } from "../entity/userLoginSession";
import { Response } from "node-fetch";
import fetch from "node-fetch"
    ;
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { IPtaUser } from "../entity/PtaUser";

class PtaAPI {

    private readonly baseUrl: string = "https://pintia.cn/api/";
    private readonly problemUrl: string = "https://pintia.cn/api/problem-sets/";
    private readonly examUrl: string = "https://pintia.cn/api/exams/";
    private readonly submissionUrl: string = "https://pintia.cn/api/submissions/";
    private readonly wechatAuthUrl: string = "https://passport.pintia.cn/api/oauth/wechat/official-account/auth-url/";
    private readonly wechatAuthState: string = "https://passport.pintia.cn/api/oauth/wechat/official-account/state/";
    private readonly wechatAuthUser: string = "https://passport.pintia.cn/api/oauth/wechat/state/";

    private readonly cachePath: string = path.join(configPath, "cache");
    /**
     * 
     * https://pintia.cn/api/problem-sets/always-available
     * 
     * @returns 
     */
    public async getAllProblemSets(): Promise<IProblemSet[]> {
        const filePath = path.join(this.cachePath, "problemSets.json");
        if (await fs.pathExists(filePath)) {
            return await fs.readJSON(filePath);
        }

        const data = await httpGet(this.problemUrl + "always-available").then(json => json["problemSets"]);
        const problemSet: IProblemSet[] = [];
        for (const item of data) {
            const summaries: IProblemSummary = await this.getProblemSummary(item.id);  // id: ProblemSetID
            summaries.numType = Object.keys(summaries).length;
            item.summaries = summaries;

            problemSet.push(item);
        }
        await fs.createFile(filePath);
        await fs.writeJson(filePath, problemSet);
        return problemSet;
    }

    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problem-summaries
     * 
     * @param psID ProblemSetID
     * @returns 
     */
    public async getProblemTypeNum(psID: string): Promise<number> {
        const data = await this.getProblemSummary(psID);
        return Object.keys(data).length;
    }


    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problem-summaries
     * 
     * @param psID ProblemSetID
     * @returns 
     */
    public async getProblemSummary(psID: string): Promise<any> {
        return await httpGet(this.problemUrl + `${psID}/problem-summaries`)
            .then(json => json["summaries"]);
    }

    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problem-list?problem_type=PROGRAMMING
     * 
     * @param psID ProblemSetID
     * @param problemType ProblemType in ('PROGRAMMING', 'CODE_COMPLETION')
     * @returns 
     */
    public async getProblemInfoListByPage(psID: string, problemType: ProblemType, page: number, limit?: number): Promise<IProblemInfo[]> {
        if (limit === undefined || limit === null) {
            limit = 200;
        }
        const problemList: IProblemInfo[] = await this.getAllProblemInfoList(psID, problemType);
        const data = [];
        for (let i = 0; i < limit; i++) {
            if (page * limit + i >= problemList.length) break;
            data.push(problemList[page * limit + i]);
        }
        return data;
    }

    public async getAllProblemInfoList(psID: string, problemType: ProblemType): Promise<IProblemInfo[]> {
        const filePath = path.join(this.cachePath, psID, problemType + ".json");
        if (await fs.pathExists(filePath)) {
            return await fs.readJSON(filePath);
        }

        const total = await this.getProblemNum(psID, problemType), limit = 200;
        const pageNum: number = Math.ceil(total / limit);

        let problemList: Array<IProblemInfo> = [];
        for (let page = 0; page < pageNum; page++) {
            const data = await httpGet(this.problemUrl + `${psID}/problem-list?problem_type=${problemType}&page=${page}&limit=${limit}`)
                .then(json => json["problemSetProblems"]);
            data.forEach((e: IProblemInfo) => problemList.push(e));
            // problemList = problemList.concat(await this.getProblemInfoListByPage(psID, problemType, page, limit));
        }

        await fs.createFile(filePath);
        await fs.writeJson(filePath, problemList);
        return problemList;
    }

    private async getProblemNum(psID: string, problemType: ProblemType): Promise<number> {
        return await this.getProblemSummary(psID)
            .then(json => {
                // console.log(json);
                return json[problemType];
            })
            .then(summary => summary.total)
            .catch(reason => console.log("Problem summary error: " + reason));
    }


    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problems/{pID}
     * 
     * @param psID 
     * @param pID 
     * @returns 
     */
    public async getProblem(psID: string, pID: string): Promise<IProblem> {
        const filePath = path.join(this.cachePath, psID, pID + ".json");
        if (await fs.pathExists(filePath)) {
            return await fs.readJSON(filePath);
        }

        const data: IProblem = await httpGet(this.problemUrl + `${psID}/problems/${pID}`)
            .then(json => json["problemSetProblem"]);

        await fs.createFile(filePath);
        await fs.writeJson(filePath, data);
        return data;
    }

    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/exams
     * 
     * @param psID 
     * @returns 
     */
    public async getProblemSetExam(psID: string, cookie: string): Promise<IProblemSetExam> {
        // throw new Error("Getting exam need cookie.");
        return await httpGet(this.problemUrl + `${psID}/exams`, cookie).then(json => json["exam"]);
    }

    /**
     * 
     * https://pintia.cn/api/exams/{examID}/submissions
     * 
     * @param examID 
     * @param cookie 
     * @param body 
     * @returns 
     */
    public async submitSolution(examID: string, cookie: string, body: IProblemCode): Promise<IProblemSubmission> {
        return await httpPost(this.examUrl + `${examID}/submissions`, cookie, body);
    }

    /**
     * 
     * https://pintia.cn/api/submissions/{submissionID}
     * 
     * @param submissionID 
     * @param cookie 
     * @returns 
     */
    public async getProblemSubmissionResult(submissionID: string, cookie: string): Promise<IProblemSubmissionResult> {
        return await httpGet(this.submissionUrl + submissionID, cookie);
    }

    // https://passport.pintia.cn/api/oauth/wechat/official-account/auth-url
    public async getWechatAuth(): Promise<IWechatAuth> {
        return await httpGet(this.wechatAuthUrl);
    }

    // https://passport.pintia.cn/api/oauth/wechat/official-account/state/{state}
    public async getWechatAuthState(state: string): Promise<IWechatAuthState> {
        return await httpGet(this.wechatAuthState + state);
    }

    // https://passport.pintia.cn/api/oauth/wechat/state/{state}/user
    public async getWechatAuthUser(state: string): Promise<IWechatUserState> {
        return await httpGet(this.wechatAuthUser + `${state}/user`).then(json => json['user'])
    }

    // https://passport.pintia.cn/api/users/sessions/state/${state}/login_users/${userId}
    public async getWechatUserInfo(state: string, userId: string): Promise<IWechatUserInfo> {
        const response = await fetch(`https://passport.pintia.cn/api/users/sessions/state/${state}/login_users/${userId}`, {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        let userInfo: IWechatUserInfo = await response.json();
        let cookie = response.headers.get("Set-Cookie")!;
        for (const s of cookie.split(";")) {
            if (s.includes("PTASession")) {
                userInfo.cookie = s + ";";
                break;
            }
        }
        return userInfo;
    }

    public async getCurrentUser(cookie: string): Promise<IPtaUser | undefined> {
        return await httpGet("https://pintia.cn/api/u/current", cookie)
            .then(json => json['user']);
    }

    public async signOut(cookie: string): Promise<void> {
        await fetch("https://pintia.cn/api/u/info", {
            method: "DELETE",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cookie': cookie
            }
        })
            // .then(response => {})
            .catch(reason => console.log(reason));
    }
}

export const ptaApi = new PtaAPI();