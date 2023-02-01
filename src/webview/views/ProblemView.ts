
import { IProblem } from '../../entity/IProblem';
import { IProblemInfo } from '../../entity/IProblemInfo';
import { ptaManager } from "../../PtaManager";
import { compilerLangMapping, ProblemType } from '../../shared';
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

    private problem!: IProblem;

    constructor(psID: string, pID: string) {
        this.id = pID;
        this.problemSetId = psID;
    }

    public async fetch(): Promise<void> {
        const problem = await ptaApi.getProblem(this.problemSetId, this.id, ptaManager.getUserSession()?.cookie);
        const problemInfo: IProblemInfo = await ptaApi.getProblemInfoByID(this.problemSetId, this.id, problem.type as ProblemType);

        this.problem = problem;
        this.id = problem.id;
        this.label = problem.label;
        this.title = problem.title;
        this.author = problem.author;
        this.content = problem.content;
        this.problemSetId = problem.problemSetId;
        this.organization = problem.authorOrganization.name;
        this.lastSubmissionId = problem.lastSubmissionId;
        this.type = problem.type as ProblemType;
        this.score = problem.score;

        this.problemSetName = await ptaApi.getProblemSetName(this.problemSetId);

        this.acceptCount = problemInfo.acceptCount;
        this.submitCount = problemInfo.submitCount;
        this.lastSubmittedLang = this.getLastSubmittedLang();
        this.lastProgram = this.getLastSubmittedProgram();
    }

    private getLastSubmittedLang(): string {
        if (!this.lastSubmissionId || this.lastSubmissionId === "0") {
            return "";
        }
        if (this.type === ProblemType.MULTIPLE_FILE) {
            return "Verilog";
        }
        const lastSubmittedCompiler: string = (this.problem.lastSubmissionDetail?.programmingSubmissionDetail
            ?? this.problem.lastSubmissionDetail?.codeCompletionSubmissionDetail)?.compiler
            ?? this.problem.compiler;
        const lang: string = compilerLangMapping.get(lastSubmittedCompiler)?.trim() ?? "";
        const pos: number = lang.indexOf("(");
        if (pos !== -1) {
            return lang.substring(0, pos - 1);
        }
        return lang;
    }

    private getLastSubmittedProgram(): string {
        if (!this.lastSubmissionId || this.lastSubmissionId === "0") {
            return "";
        }
        if (this.type === ProblemType.MULTIPLE_FILE) {
            const content = this.problem.lastSubmissionDetail?.multipleFileSubmissionDetail?.fileContents;
            if (!content || Object.keys(content).length === 0) {
                return "";
            }
            return content[Object.keys(content)[0]];
        }
        return (this.problem.lastSubmissionDetail?.programmingSubmissionDetail
            ?? this.problem.lastSubmissionDetail?.codeCompletionSubmissionDetail)?.program
            ?? "";
    }

}