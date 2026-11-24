import { l10n } from "vscode";
import { IProblem } from "../entity/IProblem";

/** 题目样例的原始结构 */
export interface IExampleTestData {
    name: string;
    input: string;
    output: string;
}

/** 测试样例的来源 */
export type TestSampleSource = "default" | "custom" | "problem" | "direct" | "file";

/** 一条可测试的样例 */
export interface TestSample {
    /** 稳定标识：default:0 / custom:1 / problem:0 / direct / file */
    id: string;
    source: TestSampleSource;
    /** 同来源内的序号，从 0 开始 */
    index: number;
    name?: string;
    input: string;
    /** undefined 表示客户端无法推导期望输出；"" 表示官方期望输出就是空 */
    expected?: string;
}

function getExampleTestDatas(problem: IProblem): IExampleTestData[] {
    const config =
        problem.problemConfig?.programmingProblemConfig ?? problem.problemConfig?.codeCompletionProblemConfig;
    return (config?.exampleTestDatas as IExampleTestData[] | undefined) ?? [];
}

function exampleTestDataKey(data: IExampleTestData): string {
    return `${data.input}\u0000${data.output}`;
}

function sameExampleTestData(a: IExampleTestData[], b: IExampleTestData[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((data, index) => exampleTestDataKey(data) === exampleTestDataKey(b[index]));
}

/**
 * 去掉题目样例里的重复项。
 *
 * 拼题A 的 `exampleTestDatas` 会把同一组样例重复一遍（模板里是 `[a, a]`，
 * 真实响应里常见 `[a, b, a, b]`）。历史实现用 `length / 2` 取前一半，
 * 这里改成先验证「前后两半完全镜像」，再回退到按 input/output 去重，
 * 避免接口变化或奇数长度时截断数据。
 */
export function getUniqueExampleTestDatas(problem: IProblem): IExampleTestData[] {
    const datas = getExampleTestDatas(problem);
    if (datas.length <= 1) {
        return datas.slice();
    }

    const half = datas.length / 2;
    if (Number.isInteger(half) && sameExampleTestData(datas.slice(0, half), datas.slice(half))) {
        return datas.slice(0, half);
    }

    const seen = new Set<string>();
    const unique: IExampleTestData[] = [];
    for (const data of datas) {
        const key = exampleTestDataKey(data);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(data);
        }
    }
    return unique;
}

function extractProblemTestCases(content: string): Array<{ input: string; output?: string }> {
    const inputs: string[] = [];
    const outputs: string[] = [];
    for (const match of content.matchAll(/```in([\s\S]*?)```/g)) {
        const input = match[1].trim();
        if (input) {
            inputs.push(input);
        }
    }
    for (const match of content.matchAll(/```out([\s\S]*?)```/g)) {
        outputs.push(match[1].trim());
    }
    return inputs.map((input, index) => ({ input, output: outputs[index] }));
}

/**
 * 按输入查找期望输出：优先官方 `exampleTestDatas`，其次题面里的成对
 * ` ```in ` / ` ```out ` 代码块。都找不到时返回 undefined。
 */
export function findExpectedOutput(problem: IProblem, input: string = ""): string | undefined {
    const trimmed = input.trim();
    for (const data of getUniqueExampleTestDatas(problem)) {
        if (data.input.trim() === trimmed) {
            return data.output;
        }
    }
    for (const data of extractProblemTestCases(problem.content ?? "")) {
        if (data.input.trim() === trimmed && data.output !== undefined) {
            return data.output;
        }
    }
    return undefined;
}

/** 输入去重使用的归一化：换行符统一 + 去首尾空白 */
function testInputKey(input: string): string {
    return (input ?? "").replace(/\r\n?/g, "\n").trim();
}

/**
 * 聚合默认、自定义、题目内三类样例。
 *
 * 输入相同的样例只保留一条，优先级为 默认 > 题目内 > 自定义。
 * 展示顺序仍为 default → custom → problem，来源内保持原顺序。
 */
export function collectTestSamples(problem: IProblem, customTests?: readonly string[]): TestSample[] {
    const defaultSamples: TestSample[] = getUniqueExampleTestDatas(problem).map((data, index) => ({
        id: `default:${index}`,
        source: "default",
        index,
        name: data.name?.trim() || undefined,
        input: data.input,
        expected: data.output,
    }));

    const customSamples: TestSample[] = (customTests ?? []).map((input, index) => ({
        id: `custom:${index}`,
        source: "custom",
        index,
        input,
        expected: findExpectedOutput(problem, input),
    }));

    const problemSamples: TestSample[] = extractProblemTestCases(problem.content ?? "").map(({ input }, index) => ({
        id: `problem:${index}`,
        source: "problem",
        index,
        input,
        expected: findExpectedOutput(problem, input),
    }));

    const seen = new Set<string>();
    const dedupe = (samples: TestSample[]): TestSample[] => {
        const kept: TestSample[] = [];
        for (const sample of samples) {
            const key = testInputKey(sample.input);
            if (!key || seen.has(key)) {
                continue;
            }
            seen.add(key);
            kept.push(sample);
        }
        return kept;
    };

    // 先按优先级占位，再按展示顺序排列
    const keptDefault = dedupe(defaultSamples);
    const keptProblem = dedupe(problemSamples);
    const keptCustom = dedupe(customSamples);

    const reindex = (samples: TestSample[], source: "default" | "custom" | "problem"): TestSample[] =>
        samples.map((sample, index) => ({ ...sample, index, id: `${source}:${index}` }));

    return [...reindex(keptDefault, "default"), ...reindex(keptCustom, "custom"), ...reindex(keptProblem, "problem")];
}

/** 构造直接输入/文件读取产生的临时样例 */
export function createAdHocSample(source: "direct" | "file", input: string, name?: string): TestSample {
    return {
        id: source,
        source,
        index: 0,
        name,
        input,
        expected: undefined,
    };
}

/** QuickPick 与测试结果页共用的来源文案 */
export function testSampleSourceLabel(source: TestSampleSource): string {
    switch (source) {
        case "default":
            return l10n.t("Default");
        case "custom":
            return l10n.t("Custom");
        case "problem":
            return l10n.t("From the problem");
        case "direct":
            return l10n.t("Direct input");
        case "file":
            return l10n.t("From file");
        default:
            return "";
    }
}

/**
 * 把多行输入压成适合 QuickPick 单行展示的摘要。
 *
 * 只显示第一行时，首行相同的样例在列表里无法区分；这里用 `↵` 连接
 * 前几行非空内容，并在还有更多行时追加省略号。
 */
export function previewTestSampleInput(input: string, maxLength: number = 160, maxLines: number = 4): string {
    const lines = (input ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) {
        return "";
    }

    const shown = lines.slice(0, maxLines);
    let preview = shown.join(" ↵ ");
    if (lines.length > shown.length) {
        preview += " ↵ …";
    }
    return preview.length > maxLength ? `${preview.slice(0, maxLength)}…` : preview;
}
