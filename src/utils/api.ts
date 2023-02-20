import { IProblem } from "../entity/IProblem";
import { IProblemInfo } from "../entity/IProblemInfo";
import { IProblemSet } from "../entity/IProblemSet";
import { IProblemSetExam } from "../entity/IProblemSetExam";
import { IProblemSubmission } from "../entity/IProblemSubmission";
import { IProblemSubmissionResult } from "../entity/IProblemSubmissionResult";
import { IProblemSummary } from "../entity/IProblemSummary";
import { IProblemCode } from "../entity/problemSubmissionCode";
import { cacheDirPath, ProblemType, ptaCache } from "../shared";
import { httpGet, httpPost } from "./httpUtils";

import * as fs from "fs-extra";
import fetch from "node-fetch";
import * as path from "path";
import { ICheckIn, ICheckInStatus } from "../entity/checkin";
import { IDashSection } from "../entity/IDashSection";
import { IExamProblemStatus } from "../entity/IExamProblemStatus";
import { IPtaUser } from "../entity/IPtaUser";
import { IWechatAuth, IWechatAuthState, IWechatUserInfo, IWechatUserState } from "../entity/userLoginSession";
import { ptaChannel } from "../ptaChannel";

class PtaAPI {

    private readonly problemUrl: string = "https://pintia.cn/api/problem-sets";
    private readonly examUrl: string = "https://pintia.cn/api/exams";
    private readonly submissionUrl: string = "https://pintia.cn/api/submissions";
    private readonly wechatAuthUrl: string = "https://passport.pintia.cn/api/oauth/wechat/official-account/auth-url";
    private readonly wechatAuthState: string = "https://passport.pintia.cn/api/oauth/wechat/official-account/state";
    private readonly wechatAuthUser: string = "https://passport.pintia.cn/api/oauth/wechat/state";
    private readonly dashboardUrl: string = "https://pintia.cn/api/content/dashboard";


    public async getDashSections(): Promise<IDashSection[]> {
        const filePath = path.join(cacheDirPath, "dashboard.json");
        if (await fs.pathExists(filePath)) {
            ptaChannel.appendLine(`[INFO] Read the cache of dashboard from the "${filePath}"`);
            return await fs.readJSON(filePath);
        }

        const sections: IDashSection[] = await httpGet(this.dashboardUrl)
            .then(json => json["content"])
            .then(content => JSON.parse(content).sections);
        await fs.createFile(filePath);
        await fs.writeJson(filePath, sections);
        return sections;
    }


    /**
     * 
     * https://pintia.cn/api/problem-sets/always-available
     * 
     * @returns 
     */
    public async getAllProblemSets(cookie?: string): Promise<IProblemSet[]> {
        const filePath = path.join(cacheDirPath, "problemSets.json");
        if (await fs.pathExists(filePath)) {
            ptaChannel.appendLine(`[INFO] Read the cache of problem sets from the "${filePath}"`);
            return await fs.readJSON(filePath);
        }

        const data: IProblemSet[] = await httpGet(`${this.problemUrl}/always-available`).then(json => json["problemSets"]);
        const problemSet: IProblemSet[] = [];
        for (const item of data) {
            const summaries: IProblemSummary = await this.getProblemSummary(item.id);  // id: ProblemSetID
            item.summaries = summaries;
            if (cookie) {
                const permission: number | undefined = await this.getProblemPermission(item.id, cookie);
                item.permission = {
                    permission: permission ?? 0
                }
            }
            problemSet.push(item);
        }
        await fs.createFile(filePath);
        await fs.writeJson(filePath, problemSet);
        return problemSet;
    }

    public async getProblemPermission(psID: string, cookie: string): Promise<number | undefined> {
        const problemSet: IProblemSet = await httpGet(`https://pintia.cn/api/problem-sets/${psID}/exams`, cookie)
            .then(json => json["problemSet"]);
        return problemSet.permission?.permission;
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
    public async getProblemSummary(psID: string): Promise<IProblemSummary> {
        return await httpGet(`${this.problemUrl}/${psID}/problem-summaries`)
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
        const filePath = path.join(cacheDirPath, psID, problemType + ".json");
        if (await fs.pathExists(filePath)) {
            ptaChannel.appendLine(`[INFO] Read the problem list from the "${filePath}"`);
            return await fs.readJSON(filePath);
        }

        const total = await this.getProblemNum(psID, problemType), limit = 200;
        const pageNum: number = Math.ceil(total / limit);

        let problemList: Array<IProblemInfo> = [];
        for (let page = 0; page < pageNum; page++) {
            const data = await httpGet(`${this.problemUrl}/${psID}/problem-list?problem_type=${problemType}&page=${page}&limit=${limit}`)
                .then(json => json["problemSetProblems"]);
            data.forEach((e: IProblemInfo) => problemList.push(e));
        }

        await fs.createFile(filePath);
        await fs.writeJson(filePath, problemList);
        return problemList;
    }

    public async getProblemInfoByID(psID: string, pID: string, problemType?: ProblemType): Promise<IProblemInfo> {
        if (!problemType) {
            const problem: IProblem = await this.getProblem(psID, pID);
            problemType = problem.type as ProblemType;
        }
        const filePath = path.join(cacheDirPath, psID, problemType + ".json");
        if (await fs.pathExists(filePath)) {
            ptaChannel.appendLine(`[INFO] Read the problem list from the "${filePath}"`);
            const problemInfoList: Array<IProblemInfo> = await fs.readJSON(filePath);
            for (const item of problemInfoList) {
                if (item["id"] === pID) {
                    return item;
                }
            }
        }

        const total = await this.getProblemNum(psID, problemType), limit = 200;
        const pageNum: number = Math.ceil(total / limit);

        for (let page = 0; page < pageNum; page++) {
            const data: Array<IProblemInfo> = await httpGet(`${this.problemUrl}/${psID}/problem-list?problem_type=${problemType}&page=${page}&limit=${limit}`)
                .then(json => json["problemSetProblems"]);
            for (const item of data) {
                if (item["id"] === pID) {
                    return item;
                }
            }
        }
        return Promise.reject();
    }

    private async getProblemNum(psID: string, problemType: ProblemType): Promise<number> {
        return await this.getProblemSummary(psID)
            .then(json => json[problemType])
            .then(summary => summary?.total ?? 0);
    }


    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problems/{pID}
     * 
     * @param psID 
     * @param pID 
     * @returns 
     */
    public async getProblem(psID: string, pID: string, cookie?: string): Promise<IProblem> {
        const filePath = path.join(cacheDirPath, psID, pID + ".json");
        // That cookie is not undefined denotes requirement for submission result, therefore, 
        // the problem need to be updated.
        if (!cookie && await fs.pathExists(filePath)) {
            ptaChannel.appendLine(`[INFO] Read the problem detail from the "${filePath}"`);
            return await fs.readJSON(filePath);
        }

        const data: IProblem = await httpGet(`${this.problemUrl}/${psID}/problems/${pID}`, cookie)
            .then(json => json["problemSetProblem"]);

        await fs.createFile(filePath);
        await fs.writeJson(filePath, data);
        return data;
    }

    public async getExamProblemStatus(psID: string, cookie: string): Promise<IExamProblemStatus[] | undefined> {
        return await httpGet(`https://pintia.cn/api/problem-sets/${psID}/exam-problem-status`, cookie).then(json => json["problemStatus"]);
    }

    public async getUnlockedProblemSetIDs(cookie: string): Promise<string[]> {
        const problemSets: IProblemSet[] = await ptaApi.getAllProblemSets(cookie);
        const psIDs: string[] = [];
        for (const ps of problemSets) {
            if ((ps.permission?.permission ?? 0) !== 9) {
                psIDs.push(ps.id);
            }
        }
        return psIDs;
    }

    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/exams
     * 
     * @param psID 
     * @returns 
     */
    public async getProblemSetExam(psID: string, cookie: string): Promise<IProblemSetExam> {
        const exam = await httpGet(`${this.problemUrl}/${psID}/exams`, cookie).then(json => json["exam"]);
        if (!exam) {
            await httpPost(`${this.problemUrl}/${psID}/exams`, cookie);
        }
        return await httpGet(`${this.problemUrl}/${psID}/exams`, cookie).then(json => json["exam"]);
    }

    public async getProblemSetName(psID: string): Promise<string> {
        let psID2name: Map<string, string> = ptaCache.get("psID2name");
        if (!psID2name) {
            psID2name = new Map<string, string>();
            const problemSets: IProblemSet[] = await this.getAllProblemSets();
            for (const item of problemSets) {
                psID2name.set(item.id, item.name);
            }
            ptaCache.put<Map<string, string>>("psID2name", psID2name);
        }
        const psName = psID2name.get(psID);
        if (psName) {
            return psName;
        }
        const problemSet = await httpGet(`${this.problemUrl}/${psID}/exams`).then(json => json["problemSet"] ?? "undefined");
        return problemSet["name"];
    }

    public async getProblemSet(psID: string): Promise<IProblemSet> {
        const filePath = path.join(cacheDirPath, psID + ".json");
        if (await fs.pathExists(filePath)) {
            ptaChannel.appendLine(`[INFO] Read the information of problem set from the "${filePath}"`);
            return await fs.readJSON(filePath);
        }
        const problemSet = await httpGet(`${this.problemUrl}/${psID}/exams`).then(json => json["problemSet"]);
        await fs.createFile(filePath);
        await fs.writeJson(filePath, problemSet);
        return problemSet;
    }

    public async getProblemSetCompilers(psID: string): Promise<string[]> {
        const problemSet: IProblemSet = await this.getProblemSet(psID);
        return problemSet.problemSetConfig.compilers;
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
        return await httpPost(this.examUrl + `/${examID}/submissions`, cookie, body);
    }

    /**
     * 
     * https://pintia.cn/api/submissions/{submissionID}
     * https://pintia.cn/api/submissions/{submissionId}?custom_test_data_submission=true
     * 
     * 
     * @param submissionID 
     * @param cookie 
     * @returns 
     */
    public async getProblemSubmissionResult(submissionID: string, cookie: string): Promise<IProblemSubmissionResult> {
        return await httpGet(`${this.submissionUrl}/${submissionID}`, cookie);
    }

    public async getProblemTestResult(submissionID: string, cookie: string): Promise<IProblemSubmissionResult> {
        return await httpGet(`${this.submissionUrl}/${submissionID}?custom_test_data_submission=true`, cookie);
    }

    // https://passport.pintia.cn/api/oauth/wechat/official-account/auth-url
    public async getWechatAuth(): Promise<IWechatAuth> {
        return await httpGet(this.wechatAuthUrl);
    }

    // https://passport.pintia.cn/api/oauth/wechat/official-account/state/{state}
    public async getWechatAuthState(state: string): Promise<IWechatAuthState> {
        return await httpGet(`${this.wechatAuthState}/${state}`);
    }

    // https://passport.pintia.cn/api/oauth/wechat/state/{state}/user
    public async getWechatAuthUser(state: string): Promise<IWechatUserState> {
        return await httpGet(`${this.wechatAuthUser}/${state}/user`).then(json => json['user'])
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
        });
    }

    public async checkin(cookie: string): Promise<ICheckIn> {
        return await httpPost("https://pintia.cn/api/users/checkin", cookie);
    }

    public async getCheckInStatus(cookie: string): Promise<ICheckInStatus> {
        return await httpGet("https://pintia.cn/api/users/rewards/DAILY_CHECK_IN", cookie);
    }

    public async getProblemSearchIndex(problemSetIDs: string[]): Promise<any> {
        let allProblems: any = {};
        try {
            for (const psID of problemSetIDs) {
                const problemList: Array<any> = [];
                const psName: string = await this.getProblemSetName(psID);
                const summaries: IProblemSummary = await this.getProblemSummary(psID);
                const problemTypes = Object.keys(summaries);
                let data: IProblemInfo[] = [];
                for (const problemType of problemTypes) {
                    const totalProblems: number = summaries[problemType as keyof IProblemSummary]?.total ?? 0;
                    const pages: number = Math.ceil(totalProblems / 200);
                    for (let i = 0; i < pages; i++) {
                        const problemInfo = await this.getProblemInfoListByPage(psID, problemType as ProblemType, i, 200);
                        data = data.concat(problemInfo);
                        await delay(600);
                    }
                }
                for (const item of data) {
                    problemList.push({
                        "pID": item["id"],
                        "title": item["title"],
                        "label": item["label"],
                        "score": item["score"],
                        "type": item["type"]
                    });
                }
                allProblems = Object.assign(allProblems, {
                    [`${psID}|${psName}`]: problemList
                })
            }
            return allProblems;
        } catch (error: any) {
            ptaChannel.appendLine(`[ERROR]: ${error.toString()}. The delay is too short.`);
        }
        return {};
    }
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const ptaApi = new PtaAPI();