
import { IProblem, IProblemConfig } from '../../entity/IProblem';
import { IProblemInfo } from '../../entity/IProblemInfo';
import { ptaConfig } from '../../ptaConfig';
import { ptaManager } from "../../ptaManager";
import { compilerLangMapping, IPtaCode, langCompilerMapping, ProblemType, problemTypeInfoMapping } from '../../shared';
import { ptaApi } from '../../utils/api';


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

    private problem!: IProblem;
    private instance?: ProblemView;

    constructor(psID: string, pID: string) {
        this.id = pID;
        this.problemSetId = psID;
    }

    public async fetch(): Promise<ProblemView> {
        if (this.instance) {
            return this.instance;
        }
        const problem = await ptaApi.getProblem(this.problemSetId, this.id, ptaManager.getUserSession()?.cookie);
        const problemInfo: IProblemInfo = await ptaApi.getProblemInfoByID(this.problemSetId, this.id, problem.type as ProblemType);

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
        [this.problemNote, this.lastProgram] = this.parseProblemNote(this.lastProgram, "@pintia note=start", "@pintia note=end");
        return this.instance = this;
    }

    public static parseProblemConfig(problem: IProblem): IProblemConfig | undefined {
        const prefix: string = problemTypeInfoMapping.get(problem.type)?.prefix ?? "";
        return problem.problemConfig[`${prefix}ProblemConfig` as keyof typeof problem.problemConfig] as IProblemConfig;
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
        const lastSubmissionDetail = (await ptaApi.getLastSubmissions(this.problemSetId, this.id, ptaManager.getUserSession()?.cookie ?? ""))?.submissionDetails[0];
        const lastSubmittedCompiler: string = (lastSubmissionDetail?.programmingSubmissionDetail ?? lastSubmissionDetail?.codeCompletionSubmissionDetail)?.compiler ?? this.problem.compiler;
        const lastProgram = lastSubmissionDetail?.programmingSubmissionDetail?.program ?? lastSubmissionDetail?.codeCompletionSubmissionDetail?.program ?? "";
        return [this.parseCompiler2Lang(lastSubmittedCompiler), lastProgram];
    }

    private parseProblemNote(data: string, start: string, end: string): [string, string] {
        if (!data || data.trim().length === 0) {
            return ["", ""];
        }
        let note: string = "";
        const lines: string[] = data.split('\n');
        let startLine: number = -1, endLine: number = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].indexOf(start) != -1) {
                startLine = i + 1;
            } else if (lines[i].indexOf(end) != -1 && startLine != -1 && startLine < i) {
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
            title: `${problem.label} ${problem.title}`

        };
    }
}