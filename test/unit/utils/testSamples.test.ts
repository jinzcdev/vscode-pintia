import * as assert from "assert";
import { IProblem } from "../../../src/entity/IProblem";
import {
    collectTestSamples,
    createAdHocSample,
    findExpectedOutput,
    getUniqueExampleTestDatas,
    previewTestSampleInput,
    testSampleSourceLabel,
} from "../../../src/utils/testSamples";

interface IExample {
    name: string;
    input: string;
    output: string;
}

function createProblem(exampleTestDatas: IExample[], content: string = ""): IProblem {
    return {
        problemConfig: {
            programmingProblemConfig: { exampleTestDatas },
            codeCompletionProblemConfig: undefined,
        },
        content,
        title: "题目",
    } as unknown as IProblem;
}

describe("utils/testSamples - 默认样例去重", () => {
    it("应识别前后两半完全镜像的重复样例", () => {
        const a = { name: "", input: "1", output: "2" };
        const b = { name: "", input: "3", output: "4" };

        assert.deepStrictEqual(getUniqueExampleTestDatas(createProblem([a, b, a, b])), [a, b]);
    });

    it("单个样例重复两次时只保留一个", () => {
        const a = { name: "", input: "1", output: "2" };

        assert.deepStrictEqual(getUniqueExampleTestDatas(createProblem([a, a])), [a]);
    });

    it("非镜像数据应按 input/output 去重并保持顺序", () => {
        const a = { name: "", input: "1", output: "2" };
        const b = { name: "", input: "3", output: "4" };

        assert.deepStrictEqual(getUniqueExampleTestDatas(createProblem([a, b, a])), [a, b]);
    });

    it("空数组应返回空数组", () => {
        assert.deepStrictEqual(getUniqueExampleTestDatas(createProblem([])), []);
    });
});

describe("utils/testSamples - 期望输出推导", () => {
    it("应使用 trim 后的输入匹配官方样例", () => {
        const problem = createProblem([{ name: "", input: "1 2\n", output: "3" }]);

        assert.strictEqual(findExpectedOutput(problem, "  1 2  "), "3");
    });

    it("匹配不到时应返回 undefined", () => {
        const problem = createProblem([{ name: "", input: "1 2", output: "3" }]);

        assert.strictEqual(findExpectedOutput(problem, "4 5"), undefined);
    });

    it("官方期望输出为空字符串时应保留空串而不是 undefined", () => {
        const problem = createProblem([{ name: "", input: "1", output: "" }]);

        assert.strictEqual(findExpectedOutput(problem, "1"), "");
    });
});

describe("utils/testSamples - 样例聚合", () => {
    it("应按 default → custom → problem 的顺序聚合并标注来源", () => {
        const problem = createProblem(
            [
                { name: "", input: "1", output: "2" },
                { name: "", input: "1", output: "2" },
            ],
            "示例：\n```in\n3\n```"
        );

        const samples = collectTestSamples(problem, ["4"]);

        assert.deepStrictEqual(
            samples.map((sample) => sample.source),
            ["default", "custom", "problem"]
        );
        assert.deepStrictEqual(
            samples.map((sample) => sample.input),
            ["1", "4", "3"]
        );
        assert.deepStrictEqual(
            samples.map((sample) => sample.expected),
            ["2", undefined, undefined]
        );
    });

    it("默认样例优先于题目内/自定义样例，重复输入应被剔除", () => {
        const problem = createProblem(
            [
                { name: "", input: "1", output: "2" },
                { name: "", input: "1", output: "2" },
            ],
            "```in\n9\n```"
        );

        const samples = collectTestSamples(problem, ["1", "9"]);

        assert.deepStrictEqual(
            samples.map((sample) => sample.source),
            ["default", "problem"]
        );
        assert.deepStrictEqual(
            samples.map((sample) => sample.input),
            ["1", "9"]
        );
    });

    it("题目内样例应优先于自定义样例", () => {
        const problem = createProblem([], "```in\n7\n```\n\n```out\n14\n```");

        const samples = collectTestSamples(problem, ["7"]);

        assert.strictEqual(samples.length, 1);
        assert.strictEqual(samples[0].source, "problem");
        assert.strictEqual(samples[0].expected, "14");
    });

    it("三类样例输入完全相同时只保留默认样例", () => {
        const problem = createProblem(
            [
                { name: "", input: "1", output: "2" },
                { name: "", input: "1", output: "2" },
            ],
            "```in\n1\n```\n```out\n2\n```"
        );

        const samples = collectTestSamples(problem, ["1"]);

        assert.strictEqual(samples.length, 1);
        assert.strictEqual(samples[0].source, "default");
    });

    it("同一来源内的重复输入也应剔除并重新编号", () => {
        const problem = createProblem([], "");

        const samples = collectTestSamples(problem, ["3", "3", "4"]);

        assert.deepStrictEqual(
            samples.map((sample) => sample.input),
            ["3", "4"]
        );
        assert.deepStrictEqual(
            samples.map((sample) => sample.index),
            [0, 1]
        );
    });

    it("去重时应忽略 CRLF 与首尾空白", () => {
        const problem = createProblem([], "```in\n  1  \n```");

        const samples = collectTestSamples(problem, ["1\r\n"]);

        assert.strictEqual(samples.length, 1);
        assert.strictEqual(samples[0].source, "problem");
    });

    it("直接输入样例不应带期望输出", () => {
        const sample = createAdHocSample("direct", "1 2");

        assert.strictEqual(sample.expected, undefined);
        assert.strictEqual(sample.source, "direct");
    });

    it("来源文案与输入摘要应可用于 QuickPick", () => {
        assert.strictEqual(testSampleSourceLabel("default"), "Default");
        assert.strictEqual(testSampleSourceLabel("problem"), "From the problem");
        assert.strictEqual(previewTestSampleInput("first\nsecond"), "first ↵ second");
        assert.strictEqual(previewTestSampleInput("123456", 3), "123…");
    });

    it("多行输入应显示多行内容，首行相同的样例也能区分", () => {
        const a = previewTestSampleInput("1 2\n3 4");
        const b = previewTestSampleInput("1 2\n5 6");

        assert.strictEqual(a, "1 2 ↵ 3 4");
        assert.notStrictEqual(a, b);
    });

    it("超过显示行数时应追加省略标记，并忽略空行与 CRLF", () => {
        const preview = previewTestSampleInput("1\r\n\r\n2\n3\n4\n5");

        assert.strictEqual(preview, "1 ↵ 2 ↵ 3 ↵ 4 ↵ …");
    });
});
