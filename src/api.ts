import fetch from "node-fetch";
import { ProblemSet } from "./entity/ProblemSet";
import { Problem } from "./entity/Problem";
import { ProblemType } from "./shared";

class PtaAPI {

    private readonly BASE_URL: string = "https://pintia.cn/api/";
    private readonly PROBLEM_URL: string = "https://pintia.cn/api/problem-sets/";

    /**
     * 
     * https://pintia.cn/api/problem-sets/always-available
     * 
     * @returns 
     */
    public async getAllProblemSets(): Promise<ProblemSet[]> {
        const data = await this.get(this.PROBLEM_URL + "always-available")
            .then(response => response["problemSets"]);

        const problemSet: ProblemSet[] = [];
        for (const pbs of data) {
            const typeNum = await this.getProblemTypeNum(pbs.id);
            pbs.multiType = typeNum > 1;
            problemSet.push(pbs);
        }
        return problemSet;
    }

    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problem-summaries
     * 
     * @param psID ProblemSetID
     * @returns 
     */
    public async getProblemTypeNum(psID: number | string): Promise<number> {
        const data = await this.get(this.PROBLEM_URL + `${psID}/problem-summaries`)
            .then(response => response["summaries"]);
        return Object.keys(data).length;
    }

    /**
     * 
     * https://pintia.cn/api/problem-sets/{psID}/problem-list?problem_type=PROGRAMMING
     * 
     * @param psID ProblemSetID
     * @param problemType ProblemType in ('PROGRAMMING', 'CODE_COMPLETION')
     * @returns 
     */
    public async getProblemList(psID: number | string, problemType: ProblemType): Promise<Problem[]> {
        const data = await this.get(this.PROBLEM_URL + `${psID}/problem-list?problem_type=${problemType}`)
            .then(response => response["problemSetProblems"]);
        const problemList: Problem[] = [];
        data.forEach((e: Problem) => problemList.push(e));
        return problemList;
    }

    private async get(url: string, cookie: string = ''): Promise<any> {
        return await fetch(url, {
            method: "GET",
            headers: { 'accept': 'application/json' }
        })
            .then(response => response.json())
            .catch(reason => console.log(reason));
    }

    private async post(url: string, cookie: string = ''): Promise<any> {
        return await fetch(url, {
            method: "POST",
            headers: { 'accept': 'application/json', 'cookie': cookie }
        })
            .then(response => response.json())
            .catch(reason => console.log(reason));
    }
}

export const ptaApi = new PtaAPI();