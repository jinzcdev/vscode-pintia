import { IProblem, IProblemConfig } from "../../entity/IProblem";
import { IProblemInfo } from "../../entity/IProblemInfo";
import { ptaConfig } from "../../ptaConfig";
import { ptaManager } from "../../ptaManager";
import { compilerLangMapping, IPtaCode, langCompilerMapping, ProblemType, problemTypeInfoMapping } from "../../shared";
import { ptaApi } from "../../utils/api";

export class ProblemView {
    public id: string = "";
    public label: string = "";
    public title: string = "";
    public author: string = "";
    public content: string = "";
    public problemSetId: string = "";
    public problemSetName: string = "";
    public organization: string = "";
    public lastSubmissionId: string = "";
    public lastProgram: string = "";
    public lastSubmittedLang: string = "";
    public type: ProblemType = ProblemType.PROGRAMMING;
    public score: number = 0;
    public submitCount: number = 0;
    public acceptCount: number = 0;
    public problemNote: string = "";
    public problemConfig?: IProblemConfig;
    /** 当前题型的完整题目列表（与题目集树顺序一致），用于上一题/下一题导航 */
    public problemInfoList: IProblemInfo[] = [];

    private problem!: IProblem;
    /** 是否已加载过，使 `fetch()` 幂等；与「单例」无关 */
    private loaded = false;

    constructor(psID: string, pID: string) {
        this.id = pID;
        this.problemSetId = psID;
    }

    public async fetch(): Promise<ProblemView> {
        if (this.loaded) {
            return this;
        }
        const problem = await ptaApi.getProblem(this.problemSetId, this.id, ptaManager.getUserSession()?.cookie);
        const problemType = problem.type as ProblemType;
        // 顺手取回完整题目列表：既用于 accept/submit 数，也用于上一题/下一题导航。
        // 列表接口有磁盘缓存；失败时回退到单题查询，不影响预览本身。
        try {
            this.problemInfoList = await ptaApi.getAllProblemInfoList(problem.problemSetId, problemType);
        } catch {
            this.problemInfoList = [];
        }
        const problemInfo: IProblemInfo =
            this.problemInfoList.find((item) => item.id === problem.id) ??
            (await ptaApi.getProblemInfoByID(problem.problemSetId, problem.id, problemType));

        this.problem = problem;
        this.id = problem.id;
        this.label = problem.label;
        this.title = problem.title;
        this.author = problem.author;
        this.content = problem.description ? problem.description : problem.content;
        this.problemSetId = problem.problemSetId;
        this.organization = problem.organization.name;
        this.lastSubmissionId = problem.lastSubmissionId;
        this.type = problem.type as ProblemType;
        this.score = problem.score;

        this.problemSetName = await ptaApi.getProblemSetName(this.problemSetId);
        this.problemConfig = ProblemView.parseProblemConfig(problem);

        this.acceptCount = problemInfo.acceptCount;
        this.submitCount = problemInfo.submitCount;
        [this.lastSubmittedLang, this.lastProgram] = await this.getLastSubmittedProgram();
        [this.problemNote, this.lastProgram] = this.parseProblemNote(
            this.lastProgram,
            "@pintia note=start",
            "@pintia note=end"
        );
        this.loaded = true;
        return this;
    }

    public static parseProblemConfig(problem: IProblem): IProblemConfig | undefined {
        const prefix: string = problemTypeInfoMapping.get(problem.type)?.prefix ?? "";
        return problem.problemConfig[`${prefix}ProblemConfig` as keyof typeof problem.problemConfig] as IProblemConfig;
    }

    /**
     * 当前题目在列表中的相邻题。
     *
     * 列表来自 `getAllProblemInfoList`（同一题集、同一题型，API 顺序），
     * 因此跨分页也能拿到上一题/下一题；当前题不在列表中时返回 undefined。
     */
    public getAdjacentProblemInfo(direction: "previous" | "next"): IProblemInfo | undefined {
        const index = this.problemInfoList.findIndex((item) => item.id === this.id);
        if (index < 0) {
            return undefined;
        }
        return direction === "previous" ? this.problemInfoList[index - 1] : this.problemInfoList[index + 1];
    }

    private parseCompiler2Lang(compiler: string): string {
        const lang: string = compilerLangMapping.get(compiler)?.trim() ?? "";
        const pos: number = lang.indexOf("(");
        if (pos !== -1) {
            return lang.substring(0, pos - 1);
        }
        return lang;
    }

    private async getLastSubmittedProgram(): Promise<string[]> {
        if (this.type === ProblemType.MULTIPLE_FILE) {
            const content = this.problem.lastSubmissionDetail?.multipleFileSubmissionDetail?.fileContents;
            if (!content || Object.keys(content).length === 0) {
                return ["Verilog", ""];
            }
            return ["Verilog", content[Object.keys(content)[0]]];
        }
        const lastSubmissionDetail = (
            await ptaApi.getLastSubmissions(this.problemSetId, this.id, ptaManager.getUserSession()?.cookie ?? "")
        )?.submissionDetails[0];
        const lastSubmittedCompiler: string =
            (lastSubmissionDetail?.programmingSubmissionDetail ?? lastSubmissionDetail?.codeCompletionSubmissionDetail)
                ?.compiler ?? this.problem.compiler;
        const lastProgram =
            lastSubmissionDetail?.programmingSubmissionDetail?.program ??
            lastSubmissionDetail?.codeCompletionSubmissionDetail?.program ??
            "";
        return [this.parseCompiler2Lang(lastSubmittedCompiler), lastProgram];
    }

    private parseProblemNote(data: string, start: string, end: string): [string, string] {
        if (!data || data.trim().length === 0) {
            return ["", ""];
        }
        let note: string = "";
        const lines: string[] = data.split("\n");
        let startLine: number = -1,
            endLine: number = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].indexOf(start) !== -1) {
                startLine = i + 1;
            } else if (lines[i].indexOf(end) !== -1 && startLine !== -1 && startLine < i) {
                const code: string = lines.slice(startLine, i).join("\n");
                if (!code.trim().length) continue;
                note = lines.slice(startLine, i).join("\n");
                endLine = i - 1;
                break;
            }
        }
        if (startLine === -1 || endLine === -1) {
            return ["", data];
        }
        let newData = lines.filter((line, index) => index < startLine - 1 || index > endLine + 1).join("\n");
        return [note, newData.replace(/^\s+|\s+$/g, "").replace(/```/g, "\\```")];
    }

    public static toPtaNode(problem: ProblemView): IPtaCode {
        const compiler: string = langCompilerMapping.get(ptaConfig.getDefaultLanguage()) ?? "GXX";
        return {
            pID: problem.id,
            psID: problem.problemSetId,
            psName: problem.problemSetName,
            problemType: problem.type as ProblemType,
            compiler: compiler,
            label: problem.label,
            title: problem.title,
        };
    }
}
