import { IProblem } from "../../entity/IProblem";
import { IProblemSubmissionResult } from "../../entity/IProblemSubmissionResult";
import { TestSample } from "../../utils/testSamples";

export type TestCasePhase = "pending" | "running" | "done" | "error" | "cancelled";

export interface TestCaseEntry {
    sample: TestSample;
    phase: TestCasePhase;
    result?: IProblemSubmissionResult;
    error?: string;
}

export class TestView {
    constructor(
        public problem: IProblem,
        public compiler: string,
        public cases: TestCaseEntry[]
    ) {}

    public static single(
        problem: IProblem,
        compiler: string,
        sample: TestSample,
        result: IProblemSubmissionResult
    ): TestView {
        return new TestView(problem, compiler, [{ sample, phase: "done", result }]);
    }
}
