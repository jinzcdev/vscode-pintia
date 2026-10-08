/**
 * 离线构建题目搜索索引（开发者本地使用，不参与 VSIX 打包）
 *
 * 用法： PINTIA_COOKIE="your_cookie" npm run build:search-index PINTIA_COOKIE="..." npm run build:search-index -- --output
 * ./resources/search_index.json --mode full
 */
import * as fs from "fs-extra";
import * as path from "path";
import fetch from "node-fetch";
import { buildSearchIndex } from "../src/searchIndex/builder";
import { SEARCH_INDEX_JSON_FILE, SEARCH_INDEX_REQUEST_DELAY_MS } from "../src/searchIndex/constants";
import { ISearchIndexApi } from "../src/searchIndex/types";
import { IProblemSummary } from "../src/entity/IProblemSummary";

/**
 * CLI 参数
 */
interface CliOptions {
    cookie: string;
    output: string;
    mode: "incremental" | "full";
    delayMs: number;
    ignoreZOJ: boolean;
}

/**
 * 不依赖 VS Code 的精简 Pintia API 客户端
 */
class StandalonePintiaApi implements ISearchIndexApi {
    private readonly problemUrl = "https://pintia.cn/api/problem-sets";

    constructor(private readonly cookie: string) {}

    private async httpGet(url: string, attempt = 0): Promise<any> {
        const maxRetries = 5;
        const initialRetryDelayMs = 2000;

        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Cookie: this.cookie,
            },
        });

        if (!response.ok) {
            const retryable = (response.status === 429 || response.status === 503) && attempt < maxRetries;
            if (retryable) {
                const waitMs = initialRetryDelayMs * Math.pow(2, attempt);
                console.warn(`HTTP ${response.status}, retry ${attempt + 1}/${maxRetries} after ${waitMs}ms`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                return this.httpGet(url, attempt + 1);
            }
            throw new Error(`HTTP ${response.status} for ${url}`);
        }

        return response.json();
    }

    public async getAlwaysAvailableProblemSets(
        _cookie?: string,
        onlyProgrammingProblem: boolean = true
    ): Promise<Array<{ id: string; name: string }>> {
        const data = await this.httpGet(`${this.problemUrl}/always-available`);
        const rawSets: Array<{ id: string; name: string }> = data.problemSets ?? [];
        const problemSets: Array<{ id: string; name: string }> = Array.from(
            new Map(rawSets.map((item) => [item.id, item])).values()
        );

        if (!onlyProgrammingProblem) {
            return problemSets;
        }

        const supportedTypes = new Set(["PROGRAMMING", "CODE_COMPLETION"]);
        const filtered: Array<{ id: string; name: string }> = [];
        for (const item of problemSets) {
            const summaries: IProblemSummary =
                data.problemSetSummaryByProblemSetId?.[item.id]?.summariesByPaperIndex?.[0]?.summaryByProblemType ??
                (await this.getProblemSummary(item.id));
            const hasSupported = Object.keys(summaries ?? {}).some((type) => supportedTypes.has(type));
            if (hasSupported) {
                filtered.push(item);
            }
        }
        return filtered;
    }

    public async getProblemSetName(psID: string): Promise<string> {
        const json = await this.httpGet(`${this.problemUrl}/${psID}/exams`);
        return json?.problemSet?.name ?? psID;
    }

    public async getProblemSummary(psID: string, _cookie?: string): Promise<IProblemSummary> {
        const json = await this.httpGet(`${this.problemUrl}/${psID}/problem-summaries`);
        return json?.summaries ?? {};
    }

    /**
     * 新题集需先参加 exam，否则 exam-problem-list 会 404
     */
    public async ensureProblemSetExam(psID: string, _cookie?: string): Promise<void> {
        const exams = await this.httpGet(`${this.problemUrl}/${psID}/exams`);
        if (exams?.exam) {
            return;
        }
        const response = await fetch(`${this.problemUrl}/${psID}/exams`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Cookie: this.cookie,
            },
            body: JSON.stringify({}),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} creating exam for ${psID}`);
        }
    }

    public async fetchExamProblemPage(
        psID: string,
        problemType: string,
        page: number,
        limit: number
    ): Promise<Array<{ id: string; title: string; label: string; score: number; type: string }>> {
        const json = await this.httpGet(
            `${this.problemUrl}/${psID}/exam-problem-list?problem_type=${problemType}&page=${page}&limit=${limit}`
        );
        return (json?.problemSetProblems ?? []).map((item: any) => ({
            id: String(item.id),
            title: String(item.title ?? ""),
            label: String(item.label ?? ""),
            score: Number(item.score ?? 0),
            type: String(item.type ?? problemType),
        }));
    }
}

/**
 * 与扩展 Cookie 登录一致：仅传 PTASession 的 value 时自动补全 key
 */
function normalizeCookie(cookie: string): string {
    const trimmed = cookie.trim();
    if (!trimmed) {
        return "";
    }
    if (!trimmed.startsWith("PTASession=")) {
        return `PTASession=${trimmed}`;
    }
    return trimmed;
}

function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = {
        cookie: process.env.PINTIA_COOKIE ?? "",
        output: path.join(process.cwd(), "resources", SEARCH_INDEX_JSON_FILE),
        mode: "incremental",
        delayMs: SEARCH_INDEX_REQUEST_DELAY_MS,
        ignoreZOJ: true,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--cookie") {
            options.cookie = argv[++i] ?? "";
        } else if (arg === "--output") {
            options.output = path.resolve(argv[++i] ?? options.output);
        } else if (arg === "--mode") {
            const mode = argv[++i];
            if (mode === "full" || mode === "incremental") {
                options.mode = mode;
            }
        } else if (arg === "--delay-ms") {
            options.delayMs = Number(argv[++i] ?? options.delayMs);
        } else if (arg === "--ignore-zoj") {
            options.ignoreZOJ = (argv[++i] ?? "true") !== "false";
        } else if (arg === "--help" || arg === "-h") {
            printHelp();
            process.exit(0);
        }
    }

    options.cookie = normalizeCookie(options.cookie);
    return options;
}

function printHelp(): void {
    console.log(`Usage: build-search-index [options]

Options:
  --cookie <value>     Pintia PTASession（完整 Cookie 或仅 value；也可用环境变量 PINTIA_COOKIE）
  --output <path>      输出 JSON 路径（默认 resources/search_index.json）
  --mode <incremental|full>  构建模式（默认 incremental）
  --delay-ms <number>  分页请求间隔毫秒（默认 1000）
  --ignore-zoj <bool>  是否忽略 ZOJ 题集（默认 true）
`);
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    if (!options.cookie) {
        console.error("Error: Pintia cookie is required. Set PINTIA_COOKIE or pass --cookie.");
        process.exit(1);
    }

    await fs.ensureDir(path.dirname(options.output));
    const api = new StandalonePintiaApi(options.cookie);

    console.log(`Building search index (${options.mode}) -> ${options.output}`);
    const stats = await buildSearchIndex(api, {
        mode: options.mode,
        indexPath: options.output,
        cookie: options.cookie,
        ignoreZOJ: options.ignoreZOJ,
        delayMs: options.delayMs,
        onProgress: (message) => console.log(`  ${message}`),
    });

    console.log(
        `Done. problemSets=${stats.problemSetsProcessed}, added=${stats.problemsAdded}, pages=${stats.pagesFetched}, typesReset=${stats.typesReset}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
