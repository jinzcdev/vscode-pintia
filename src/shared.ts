import { LEGACY_SEARCH_INDEX_JSON_FILE, SEARCH_INDEX_V2_JSON_FILE } from "./searchIndex/constants";

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { l10n } from "vscode";
import { IProblemInfo } from "./entity/IProblemInfo";
import { IProblemSummary } from "./entity/IProblemSummary";

/**
 * 注意：本模块的常量表在**模块加载期**就调用 `l10n.t`，因此 `shared` 现在会
 * 在运行时 require("vscode")。纯 Node 的脚本（如 `scripts/build-search-index.ts`）
 * 不得 import 本模块——那条链路只经过 searchIndex/* 与 entity/*。
 */

export const configPath: string = path.join(os.homedir(), ".pintia");
export const cacheDirPath: string = path.join(configPath, "cache");
/**
 * 新版题目搜索索引路径（v2）
 */
export const searchIndexPath: string = path.join(configPath, SEARCH_INDEX_V2_JSON_FILE);
/**
 * 旧版扁平索引路径；新版仅作迁移源，永不写入
 */
export const legacySearchIndexPath: string = path.join(configPath, LEGACY_SEARCH_INDEX_JSON_FILE);
export const favoriteProblemsPath: string = path.join(configPath, "favorites.json");
export const viewedProblemPath: string = path.join(configPath, "view_history.json");
export const imgUrlPrefix: string = "https://images.ptausercontent.com";
export { ZOJ_PROBLEM_SET_ID } from "./searchIndex/constants";

export import ptaCache = require("memory-cache");

export const UNKNOWN = "Unknown";
export const NO_OFFICIAL_SOLUTION = l10n.t("No official answer for this sample");
export const NONE = l10n.t("None");

export enum UserStatus {
    SignedIn = 1,
    SignedOut = 2,
}

export enum PtaLoginMethod {
    PTA = "PTA",
    WeChat = "WeChat",
    Cookie = "Cookie",
}

/**
 * 资源管理器里的分组标识。
 *
 * 值是**稳定标识符**而非展示文案：它同时被当作 map key 与比较依据
 * （见 `explorerNodeManager`），一旦随语言变化就会让分组逻辑失效。
 * 展示用的名字在拼装节点时由 `l10n.t` 生成。
 *
 * 也不能写成 `l10n.t(...)`——字符串枚举成员属于「计算成员」，TS 会拒绝（TS18033）。
 */
export enum PtaDashType {
    MyProblemSet = "myProblemSet",
    Others = "others",
}

export enum ProblemJudgingStatusEnum {
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED",
    COMPILE_ERROR = "COMPILE_ERROR",
    NEUTRAL = "NEUTRAL",
}

export interface IQuickPickItem<T> extends vscode.QuickPickItem {
    value: T;
}

export enum ProblemSubmissionState {
    PROBLEM_ACCEPTED = "PROBLEM_ACCEPTED",
    PROBLEM_WRONG_ANSWER = "PROBLEM_WRONG_ANSWER",
    PROBLEM_NO_ANSWER = "PROBLEM_NO_ANSWER",
}

export enum ProblemType {
    PROGRAMMING = "PROGRAMMING",
    CODE_COMPLETION = "CODE_COMPLETION",
    MULTIPLE_FILE = "MULTIPLE_FILE",
    TRUE_OR_FALSE = "TRUE_OR_FALSE",
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
    FILL_IN_THE_BLANK_FOR_PROGRAMMING = "FILL_IN_THE_BLANK_FOR_PROGRAMMING",
}

export enum PtaNodeType {
    Dashboard = 0,
    ProblemSet = 1,
    ProblemSubSet = 2,
    ProblemPage = 3,
    Problem = 4,
}

export enum ProblemPermissionEnum {
    UNKNOWN = -1,
    LOCKED = 9,
    MY_PROBLEM_SET = 47,
}

export enum ProblemSetExamStatus {
    PENDING = "PENDING", // 未开始
    READY = "READY", // 我的题集准备答题中
    PROCESSING = "PROCESSING", // 正在进行中
    END = "END", // 已结束
}

export interface IPtaCode {
    psID: string;
    pID: string;
    compiler: string;
    psName?: string;
    problemType?: ProblemType;
    problemSet?: string;
    label?: string;
    title?: string;
    code?: string;
    customTests?: string[];
}
export interface IPtaNode {
    dashID: number;
    pID: string;
    psID: string;
    title: string;
    label: string;
    type: PtaNodeType;
    score: number;
    isFavorite: boolean;
    state: ProblemSubmissionState;
    tag: string[];
    value: IPtaNodeValue;
    locked: boolean;
    isMyProblemSet: boolean;
}

export interface IPtaNodeValue {
    summaries: IProblemSummary;
    total: number;
    page: number;
    limit: number;
    problemSet: string;
    problemTotal: number;
    problemType: ProblemType;
    problemInfo?: IProblemInfo;
}

/**
 * 构造默认的节点取值。
 *
 * 每次调用都新建 `summaries` 对象：`getChildren` 会把懒加载的结果写回
 * `value.summaries`，共享同一个对象会让不同节点互相污染。
 */
export function createDefaultPtaNodeValue(partial: Partial<IPtaNodeValue> = {}): IPtaNodeValue {
    return {
        summaries: {
            PROGRAMMING: {
                total: 0,
                totalScore: 0,
                totalInPools: 0,
            },
            CODE_COMPLETION: {
                total: 0,
                totalScore: 0,
                totalInPools: 0,
            },
            MULTIPLE_FILE: {
                total: 0,
                totalScore: 0,
                totalInPools: 0,
            },
        },
        total: 0,
        page: 0,
        limit: 0,
        problemSet: "",
        problemTotal: 0,
        problemType: ProblemType.PROGRAMMING,
        problemInfo: undefined,
        ...partial,
    };
}

/**
 * `createDefaultPtaNode` 的入参：`value` 只给要覆盖的字段即可，其余走默认值。
 */
export type IPtaNodeInit = Omit<Partial<IPtaNode>, "value"> & { value?: Partial<IPtaNodeValue> };

/**
 * 构造默认节点。
 *
 * 刻意做成工厂而非共享常量：节点是会被就地修改的（`getChildren` 会写回
 * `value.summaries` 与 `value.problemType`），共享同一个对象会让不同节点互相污染。
 * `value` 必须逐个新建——对共享常量做浅拷贝并不能避免这个问题。
 *
 * `partial.value` 是与默认值**合并**而非整体替换，因此未显式给出的字段仍是确定值。
 */
export function createDefaultPtaNode(partial: IPtaNodeInit = {}): IPtaNode {
    return {
        dashID: 0,
        pID: "",
        psID: "",
        title: "",
        label: "",
        type: PtaNodeType.ProblemSet,
        isMyProblemSet: false,
        isFavorite: false,
        state: ProblemSubmissionState.PROBLEM_NO_ANSWER,
        score: 0,
        tag: [],
        locked: false,
        ...partial,
        value: createDefaultPtaNodeValue(partial.value),
    };
}

export type CallBack<T> = (msg: string, data?: T) => void;

export interface ProblemJudgingStatus {
    color: string;
    text: string;
}

export const problemJudgingStatusMapping: Map<string, ProblemJudgingStatus> = new Map([
    ["OVERRIDDEN", { color: "", text: l10n.t("Overridden") }],
    ["WAITING", { color: "", text: l10n.t("Waiting") }],
    ["JUDGING", { color: "orange", text: l10n.t("Judging") }],
    ["COMPILE_ERROR", { color: "#237aff", text: l10n.t("Compile Error") }],
    ["ACCEPTED", { color: "#ff5555", text: l10n.t("Accepted") }],
    ["PARTIAL_ACCEPTED", { color: "#00b000", text: l10n.t("Partially Accepted") }],
    ["PRESENTATION_ERROR", { color: "#00b000", text: l10n.t("Presentation Error") }],
    ["WRONG_ANSWER", { color: "#00b000", text: l10n.t("Wrong Answer") }],
    ["MULTIPLE_ERROR", { color: "#00b000", text: l10n.t("Multiple Errors") }],
    ["TIME_LIMIT_EXCEEDED", { color: "#00b000", text: l10n.t("Time Limit Exceeded") }],
    ["MEMORY_LIMIT_EXCEEDED", { color: "#00b000", text: l10n.t("Memory Limit Exceeded") }],
    ["NON_ZERO_EXIT_CODE", { color: "#00b000", text: l10n.t("Non-zero Exit Code") }],
    ["SEGMENTATION_FAULT", { color: "#00b000", text: l10n.t("Segmentation Fault") }],
    ["FLOAT_POINT_EXCEPTION", { color: "#00b000", text: l10n.t("Floating Point Exception") }],
    ["OUTPUT_LIMIT_EXCEEDED", { color: "#00b000", text: l10n.t("Output Limit Exceeded") }],
    ["INTERNAL_ERROR", { color: "", text: l10n.t("Internal Error") }],
    ["RUNTIME_ERROR", { color: "#00b000", text: l10n.t("Runtime Error") }],
]);

export const langCompilerMapping: Map<string, string> = new Map([
    // ["", "NO_COMPILER"],
    ["C (gcc)", "GCC"],
    ["C++ (g++)", "GXX"],
    ["C (clang)", "CLANG"],
    ["C++ (clang++)", "CLANGXX"],
    ["Java (javac)", "JAVAC"],
    ["Python (python2)", "PYTHON2"],
    ["Python (python3)", "PYTHON3"],
    ["Ruby (ruby)", "RUBY"],
    ["Bash (bash)", "BASH"],
    ["Plaintext (cat)", "CAT"],
    ["CommonLisp (sbcl)", "CLISP"],
    ["Pascal (fpc)", "FPC"],
    ["Go (go)", "GO"],
    ["Haskell (ghc)", "GHC"],
    ["Lua (lua)", "LUA"],
    ["Lua (luajit)", "LUAJIT"],
    ["C# (dotnet)", "MCS"],
    ["JavaScript (node)", "NODE"],
    ["OCaml (ocamlc)", "OCAMLC"],
    ["PHP (php)", "PHP"],
    ["Perl (perl)", "PERL"],
    ["AWK (awk)", "AWK"],
    ["D (dmd)", "DMD"],
    ["Racket (racket)", "RKT"],
    ["Vala (valac)", "VALAC"],
    ["Visual Basic (dotnet)", "VBNC"],
    ["Kotlin (kotlinc)", "KOTLIN"],
    ["Swift (swiftc)", "SWIFT"],
    ["Objective-C (clang)", "OBJC"],
    ["Fortran95 (gfortran)", "FORTRAN"],
    ["Octave (octave-cli)", "OCTAVE"],
    ["R (R)", "RLANG"],
    ["ASM (nasm.sh)", "ASM"],
    ["Rust (rustc)", "RUST"],
    ["Scala (scalac)", "SCALA"],
    ["Python (pypy3)", "PYPY3"],
    ["仓颉 (cjc)", "CANGJIE"],
    ["SQL (SQL)", "SQL"],
]);

export const compilerLangMapping: Map<string, string> = new Map([
    ["GCC", "C (gcc)"],
    ["GXX", "C++ (g++)"],
    ["CLANG", "C (clang)"],
    ["CLANGXX", "C++ (clang++)"],
    ["JAVAC", "Java (javac)"],
    ["PYTHON2", "Python (python2)"],
    ["PYTHON3", "Python (python3)"],
    ["RUBY", "Ruby (ruby)"],
    ["BASH", "Bash (bash)"],
    ["CAT", "Plaintext (cat)"],
    ["CLISP", "CommonLisp (sbcl)"],
    ["FPC", "Pascal (fpc)"],
    ["GO", "Go (go)"],
    ["GHC", "Haskell (ghc)"],
    ["LUA", "Lua (lua)"],
    ["LUAJIT", "Lua (luajit)"],
    ["MCS", "C# (dotnet)"],
    ["NODE", "JavaScript (node)"],
    ["OCAMLC", "OCaml (ocamlc)"],
    ["PHP", "PHP (php)"],
    ["PERL", "Perl (perl)"],
    ["AWK", "AWK (awk)"],
    ["DMD", "D (dmd)"],
    ["RKT", "Racket (racket)"],
    ["VALAC", "Vala (valac)"],
    ["VBNC", "Visual Basic (dotnet)"],
    ["KOTLIN", "Kotlin (kotlinc)"],
    ["SWIFT", "Swift (swiftc)"],
    ["OBJC", "Objective-C (clang)"],
    ["FORTRAN", "Fortran95 (gfortran)"],
    ["OCTAVE", "Octave (octave-cli)"],
    ["RLANG", "R (R)"],
    ["ASM", "ASM (nasm.sh)"],
    ["RUST", "Rust (rustc)"],
    ["SCALA", "Scala (scalac)"],
    ["PYPY3", "Python (pypy3)"],
    ["CANGJIE", "仓颉 (cjc)"],
    ["SQL", "SQL (SQL)"],
]);

export const commentFormatMapping: Map<string, { single: string; start: string; middle: string; end: string }> =
    new Map([
        ["C++ (g++)", { single: "// ", start: "/* ", middle: " * ", end: " */" }],
        ["Python (python2)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
        ["Python (python3)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
        ["Python (pypy3)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
        ["Bash (bash)", { single: "# ", start: "# ", middle: "# ", end: "" }],
    ]);

export const problemTypeInfoMapping: Map<string, ProblemTypeInfo> = new Map([
    [
        "TRUE_OR_FALSE",
        { name: l10n.t("True or False"), type: 1, prefix: "trueOrFalse", problemConfigKey: "trueOrFalseProblemConfig" },
    ],
    [
        "MULTIPLE_CHOICE",
        {
            name: l10n.t("Multiple Choice"),
            type: 2,
            prefix: "multipleChoice",
            problemConfigKey: "multipleChoiceProblemConfig",
        },
    ],
    [
        "FILL_IN_THE_BLANK_FOR_PROGRAMMING",
        {
            name: l10n.t("Fill in the Blanks"),
            type: 5,
            prefix: "fillInTheBlankForProgramming",
            problemConfigKey: "fillInTheBlankForProgrammingProblemConfig",
        },
    ],
    [
        "PROGRAMMING",
        {
            name: l10n.t("Programming"),
            type: 7,
            prefix: "programming",
            problemConfigKey: "programmingProblemConfig",
        },
    ],
    [
        "CODE_COMPLETION",
        {
            name: l10n.t("Code Completion"),
            type: 6,
            prefix: "codeCompletion",
            problemConfigKey: "codeCompletionProblemConfig",
        },
    ],
    [
        "MULTIPLE_FILE",
        {
            name: l10n.t("Multiple File Programming"),
            type: 9,
            prefix: "multipleFile",
            problemConfigKey: "multipleFileProblemConfig",
        },
    ],
]);

export interface ProblemTypeInfo {
    name: string;
    type: number;
    prefix: string;
    problemConfigKey: string;
}

export const supportedProblemTypes: Set<string> = new Set(["PROGRAMMING", "CODE_COMPLETION"]);

export const colorThemeMapping: Map<string, string[]> = new Map([
    ["atom-one", ["atom-one-light.min.css", "atom-one-dark.min.css"]],
    ["github", ["github.min.css", "github-dark.min.css"]],
    ["a11y", ["a11y-light.min.css", "a11y-dark.min.css"]],
    ["stackoverflow", ["stackoverflow-light.min.css", "stackoverflow-dark.min.css"]],
    ["kimbie", ["kimbie-light.min.css", "kimbie-dark.min.css"]],
]);

/**
 * 预览题目后如何打开工作区。
 *
 * 定义在 shared 而非 workspaceUtils：`ptaConfig` 要拿它当默认值，
 * 而 workspaceUtils 又要读 ptaConfig——放在 workspaceUtils 里会让两者成环。
 */
export enum OpenOptionEnum {
    alwaysAsk = "Always ask",
    justOpenFile = "Just open the problem file",
    openInCurrentWindow = "Open in current window",
    openInNewWindow = "Open in new window",
    addToWorkspace = "Add to workspace",
}

export enum DescriptionConfiguration {
    InWebView = "In Webview",
    InFileComment = "In File Comment",
    Both = "Both",
    None = "None",
}

// https://static.pintia.cn/exam-app/de820dad2723a0dce4e1.chunk.js
export const ptaCompiler = {
    NO_COMPILER: {
        name: "NO_COMPILER",
        ordinal: 0,
        isHidden: !0,
        ext: "",
        language: "",
        displayName: "",
        version: "",
    },
    GCC: {
        name: "GCC",
        ordinal: 1,
        ext: "c",
        language: "C",
        displayName: "gcc",
        version: "11.4.0",
        compileCmd: "gcc -DONLINE_JUDGE -fno-tree-ch -O2 -Wall -std=c99 -pipe $src -lm -o $exe",
    },
    GXX: {
        name: "GXX",
        ordinal: 2,
        ext: "cpp",
        language: "C++",
        displayName: "g++",
        version: "11.4.0",
        compileCmd: "g++ -DONLINE_JUDGE -fno-tree-ch -O2 -Wall -std=c++17 -pipe $src -lm -o $exe",
    },
    CLANG: {
        name: "CLANG",
        ordinal: 3,
        ext: "clang.c",
        language: "C",
        displayName: "clang",
        version: "17.0.6",
        compileCmd: "clang -DONLINE_JUDGE -O2 -Wall -std=c99 -pipe $src -lm -o $exe",
    },
    CLANGXX: {
        name: "CLANGXX",
        ordinal: 4,
        ext: "clang.cpp",
        language: "C++",
        displayName: "clang++",
        version: "17.0.6",
        compileCmd: "clang++ -DONLINE_JUDGE -O2 -Wall -std=c++17 -pipe $src -lm -o $exe",
    },
    JAVAC: {
        name: "JAVAC",
        ordinal: 5,
        ext: "java",
        language: "Java",
        displayName: "javac",
        version: "11.0.19",
        compileCmd: "javac -encoding UTF8 $src",
        runCmd: "java Main",
    },
    PYTHON2: {
        name: "PYTHON2",
        ordinal: 6,
        ext: "py",
        language: "Python",
        displayName: "python2",
        version: "2.7.17",
        runCmd: "python2 $src",
    },
    PYTHON3: {
        name: "PYTHON3",
        ordinal: 7,
        ext: "3.py",
        language: "Python",
        displayName: "python3",
        version: "3.10.13",
        runCmd: "python3 $src",
    },
    RUBY: {
        name: "RUBY",
        ordinal: 8,
        ext: "rb",
        language: "Ruby",
        displayName: "ruby",
        version: "2.7.5",
        runCmd: "ruby $src",
    },
    BASH: {
        name: "BASH",
        ordinal: 9,
        ext: "sh",
        language: "Bash",
        displayName: "bash",
        version: "4.4.20",
        runCmd: "bash $src",
    },
    CAT: {
        name: "CAT",
        ordinal: 10,
        ext: "txt",
        language: "Plaintext",
        displayName: "cat",
        version: "1.0",
        runCmd: "cat $src",
    },
    CLISP: {
        name: "CLISP",
        ordinal: 11,
        ext: "cl",
        language: "Common Lisp",
        displayName: "sbcl",
        version: "1.4.5",
        runCmd: "sbcl --script $src",
    },
    FPC: {
        name: "FPC",
        ordinal: 12,
        ext: "pas",
        language: "Pascal",
        displayName: "fpc",
        version: "3.0.4",
        compileCmd: "fpc -dONLINE_JUDGE -O2 $src",
    },
    GO: {
        name: "GO",
        ordinal: 13,
        ext: "go",
        language: "Go",
        displayName: "go",
        version: "1.20.3",
        compileCmd: "go build $src",
    },
    GHC: {
        name: "GHC",
        ordinal: 14,
        ext: "hs",
        language: "Haskell",
        displayName: "ghc",
        version: "8.4.3",
        compileCmd: "ghc -v0 -O2 --make -threaded $src -o $exe",
    },
    LUA: {
        name: "LUA",
        ordinal: 15,
        ext: "lua",
        language: "Lua",
        displayName: "lua",
        version: "5.2.4",
        runCmd: "lua $src",
    },
    LUAJIT: {
        name: "LUAJIT",
        ordinal: 16,
        ext: "jit.lua",
        language: "Lua",
        displayName: "luajit",
        version: "2.1.0",
        runCmd: "luajit $src",
    },
    MCS: {
        name: "MCS",
        ordinal: 17,
        ext: "cs",
        language: "C#",
        displayName: "dotnet",
        version: "6.0.413",
        compileCmd: "dotnet build",
        runCmd: "$exe",
    },
    NODE: {
        name: "NODE",
        ordinal: 18,
        ext: "js",
        language: "JavaScript",
        displayName: "node",
        version: "12.22.12",
        runCmd: "node $src",
    },
    OCAMLC: {
        name: "OCAMLC",
        ordinal: 19,
        ext: "ml",
        language: "OCaml",
        displayName: "ocamlc",
        version: "4.05.0",
        compileCmd: "ocamlc -unsafe $src -o $exe",
    },
    PHP: {
        name: "PHP",
        ordinal: 20,
        ext: "php",
        language: "PHP",
        displayName: "php",
        version: "7.2.24",
        runCmd: "php $src",
    },
    PERL: {
        name: "PERL",
        ordinal: 21,
        ext: "pl",
        language: "Perl",
        displayName: "perl",
        version: "5.26.1",
        runCmd: "perl $src",
    },
    AWK: {
        name: "AWK",
        ordinal: 22,
        ext: "awk",
        language: "AWK",
        displayName: "awk",
        version: "4.1.4",
        runCmd: "awk -f $src",
    },
    DMD: {
        name: "DMD",
        ordinal: 23,
        ext: "d",
        language: "D",
        displayName: "dmd",
        version: "2.074.1",
        compileCmd: "dmd -O $src -of$exe",
    },
    RKT: {
        name: "RKT",
        ordinal: 24,
        ext: "rkt",
        language: "Racket",
        displayName: "racket",
        version: "6.11",
        compileCmd: "raco make $src",
        runCmd: "racket $src",
    },
    VALAC: {
        name: "VALAC",
        ordinal: 25,
        ext: "vala",
        language: "Vala",
        displayName: "valac",
        version: "0.40.23",
        compileCmd: "valac -D ONLINE_JUDGE --thread $src -o $exe",
    },
    VBNC: {
        name: "VBNC",
        ordinal: 26,
        ext: "vb",
        language: "Visual Basic",
        displayName: "dotnet",
        version: "6.0.413",
        compileCmd: "dotnet build",
        runCmd: "$exe",
    },
    KOTLIN: {
        name: "KOTLIN",
        ordinal: 27,
        ext: "kt",
        language: "Kotlin",
        displayName: "kotlinc",
        version: "1.6.21",
        compileCmd: "kotlinc $src -include-runtime -d Main.jar",
        runCmd: "java -jar Main.jar",
    },
    SWIFT: {
        name: "SWIFT",
        ordinal: 28,
        ext: "swift",
        language: "Swift",
        displayName: "swiftc",
        version: "4.2.4",
        compileCmd: "swiftc $src -O -o $exe",
    },
    OBJC: {
        name: "OBJC",
        ordinal: 29,
        ext: "m",
        language: "Objective-C",
        displayName: "clang",
        version: "17.0.6",
        compileCmd:
            "clang $src -MMD -MP -DGNUSTEP -DGNUSTEP_BASE_LIBRARY=1 -DGNU_GUI_LIBRARY=1 -DGNU_RUNTIME=1 -fno-strict-aliasing -fexceptions -fobjc-exceptions -D_NATIVE_OBJC_EXCEPTIONS -pthread -fPIC -Wall -DGSWARN -DGSDIAGNOSE -Wno-import -g -O2 -fgnu-runtime -fconstant-string-class=NSConstantString -fexec-charset=UTF-8 -I. -I/home/judger/GNUstep/Library/Headers -I/usr/local/include/GNUstep -I/usr/include/GNUstep -rdynamic -shared-libgcc -lgnustep-base -lobjc -lm -o $exe",
    },
    FORTRAN: {
        name: "FORTRAN",
        ordinal: 30,
        ext: "f95",
        language: "Fortran95",
        displayName: "gfortran",
        version: "7.5.0",
        compileCmd: "gfortran $src",
    },
    OCTAVE: {
        name: "OCTAVE",
        ordinal: 31,
        ext: "octave",
        language: "Octave",
        displayName: "octave-cli",
        version: "4.2.2",
        runCmd: "octave-cli --no-gui --no-history --no-init-file --no-init-path --no-line-editing --no-site-file --no-window-system --norc $src",
    },
    RLANG: {
        name: "RLANG",
        ordinal: 32,
        ext: "r",
        language: "R",
        displayName: "R",
        version: "3.6.3",
        runCmd: "R --slave --vanilla -f $src",
    },
    ASM: {
        name: "ASM",
        ordinal: 33,
        ext: "asm",
        language: "ASM",
        displayName: "nasm.sh",
        version: "2.13.02",
        compileCmd: "nasm.sh $src $exe",
    },
    RUST: {
        name: "RUST",
        ordinal: 34,
        ext: "rs",
        language: "Rust",
        displayName: "rustc",
        version: "1.79.0",
        compileCmd: "rustc --edition=2018 -O --cfg ONLINE_JUDGE $src -o $exe",
    },
    SCALA: {
        name: "SCALA",
        ordinal: 35,
        ext: "scala",
        language: "Scala",
        displayName: "scalac",
        version: "2.13.8",
        compileCmd: "scalac -encoding UTF8 $src",
        runCmd: `java -Xbootclasspath/a:/usr/share/scala/lib/jline-3.16.0.jar:/usr/share/scala/lib/jna-5.3.1.jar:/usr/share/scala/lib/scala-compiler.jar:/usr/share/scala/lib/scala-library.jar:/usr/share/scala/lib/scala-reflect.jar:/usr/share/scala/lib/scalap-2.13.4.jar -classpath '""' -Dscala.boot.class.path=/usr/share/scala/lib/jline-3.16.0.jar:/usr/share/scala/lib/jna-5.3.1.jar:/usr/share/scala/lib/scala-compiler.jar:/usr/share/scala/lib/scala-library.jar:/usr/share/scala/lib/scala-reflect.jar:/usr/share/scala/lib/scalap-2.13.4.jar -Dscala.home=/usr/share/scala -Dscala.usejavacp=true scala.tools.nsc.MainGenericRunner Main`,
    },
    PYPY3: {
        name: "PYPY3",
        ordinal: 36,
        ext: "pypy.3.py",
        language: "Python",
        displayName: "pypy3",
        version: "3.9.19",
        runCmd: "pypy3 $src",
    },
    CANGJIE: {
        name: "CANGJIE",
        ordinal: 37,
        ext: "cj",
        language: "仓颉",
        displayName: "cjc",
        version: "0.53.4",
        runCmd: "cjc $src",
        compileCmd: "cjc --cfg ENV=ONLINE_JUDGE -O2 -Won all --error-count-limit 10 $src -o $exe",
    },
    SQL: {
        name: "SQL",
        ordinal: 100,
        isHidden: !0,
        ext: "sql",
        language: "SQL",
        displayName: "SQL",
        version: "",
    },
};
