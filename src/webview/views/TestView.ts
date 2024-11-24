import { IProblemSubmissionResult } from "../../entity/IProblemSubmissionResult";

export class TestView {
    constructor(
        public result: IProblemSubmissionResult,
        public answer?: string
    ) { }
}