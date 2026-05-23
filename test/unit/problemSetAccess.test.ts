import * as assert from "assert";
import { IProblemSetExam } from "../../src/entity/IProblemSetExam";
import { ProblemSetExamStatus } from "../../src/shared";
import { isExamNotAccessible } from "../../src/utils/problemSetAccess";

describe("problemSetAccess", () => {
    /** 构造考试状态 mock 数据 */
    function createExam(status: string, hasExam: boolean): IProblemSetExam {
        return {
            status,
            exam: hasExam
                ? {
                      id: "exam-1",
                      score: 0,
                      startAt: "",
                      endAt: "",
                      examConfig: {},
                      problemSetId: "ps-1",
                      userId: "user-1",
                      ended: false,
                      existsSubmissionsNotCompleted: false,
                      status: "PROCESSING",
                  }
                : undefined,
        };
    }

    it("PENDING 且无 exam 时不可访问摘要", () => {
        assert.strictEqual(isExamNotAccessible(createExam(ProblemSetExamStatus.PENDING, false)), true);
    });

    it("READY 且无 exam 时不可访问摘要", () => {
        assert.strictEqual(isExamNotAccessible(createExam(ProblemSetExamStatus.READY, false)), true);
    });

    it("PROCESSING 且无 exam 时可尝试访问摘要", () => {
        assert.strictEqual(isExamNotAccessible(createExam(ProblemSetExamStatus.PROCESSING, false)), false);
    });

    it("已有 exam 时无论状态均可访问摘要", () => {
        assert.strictEqual(isExamNotAccessible(createExam(ProblemSetExamStatus.PENDING, true)), false);
        assert.strictEqual(isExamNotAccessible(createExam(ProblemSetExamStatus.READY, true)), false);
    });

    it("exams 为 undefined 时不视为不可访问", () => {
        assert.strictEqual(isExamNotAccessible(undefined), false);
    });
});
