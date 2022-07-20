// https://pintia.cn/api/problem-sets/{problemSet}/exams
import { IProblemSummary } from "./ProblemSummary";

export interface IProblemSet {
    id: string;
    name: string;
    type: string;
    timeType: string;
    status: string;
    organizationName: string;
    ownerNickname: string;
    manageable: boolean;
    createAt: string;
    updateAt: string;
    scoringRule: string;
    organizationType: string;
    ownerId: string;
    startAt: string;
    endAt: string;
    duration: number;
    problemSetConfig: {
        compilers: string[]; // all compilers to be allowed to use in this problem set
        multipleChoiceMoreThanOneAnswerProblemScoringMethod: string;
        scoringRule: string;
        hideScoreboard: boolean;
        hidingTime: number;
        showNameInRanking: boolean;
        hideOtherProblemSets: boolean;
        allowStudentLogin: boolean;
        allowedLoginSecondsBeforeStart: number;
        omsProtected: boolean;
        allowSubmitExam: boolean;
        useStrictCodeJudger: boolean;
        showBulletinBoard: boolean;
        showDetections: boolean;
        examGroupId: string;
        enableCustomTestData: boolean;
        enableVirtualPrinter: boolean;
        blindJudgeSubjective: boolean;
        autoSave: boolean;
        forbidPasting: boolean;
    };
    ownerOrganizationId: string;
    stage: string;

    // in exam
    description?: string;
    omsProtected?: boolean;
    permission?: {
        permission: number; // 9: no_permission, 15: have a permission
    };
    collaboratorPermission?: string;
    announcement?: string;

    // custom
    multiType: boolean;
    summaries: IProblemSummary;
}
