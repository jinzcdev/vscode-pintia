import { IProblemSetExam } from "../entity/IProblemSetExam";
import { ProblemSetExamStatus } from "../shared";

/** 判断题集考试是否尚未开始、暂不可访问题目摘要 */
export function isExamNotAccessible(exams: IProblemSetExam | undefined): boolean {
    return (
        !!exams &&
        !exams.exam &&
        (exams.status === ProblemSetExamStatus.PENDING || exams.status === ProblemSetExamStatus.READY)
    );
}
