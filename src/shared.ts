import { IProblemSummary } from "./entity/IProblemSummary";

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { IProblemInfo } from "./entity/IProblemInfo";

export const configPath: string = path.join(os.homedir(), ".pintia");
export const cacheDirPath: string = path.join(configPath, "cache");
export const searchIndexPath: string = path.join(configPath, "search_index.json");
export const favoriteProblemsPath: string = path.join(configPath, "favorites.json");
export const imgUrlPrefix: string = "https://images.ptausercontent.com";
export const ZOJ_PROBLEM_SET_ID: string = "91827364500";

export import ptaCache = require('memory-cache');

export enum UserStatus {
    SignedIn = 1,
    SignedOut = 2
}

export enum PtaLoginMethod {
    PTA = "PTA",
    WeChat = "WeChat"
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
    MULTIPLE_FILE = "MULTIPLE_FILE"
}

export enum PtaNodeType {
    Dashboard = 0,
    ProblemSet = 1,
    ProblemSubSet = 2,
    ProblemPage = 3,
    Problem = 4
}

export interface IPtaCode {
    psID: string;
    pID: string;
    compiler: string;
    psName?: string;
    problemType?: ProblemType;
    problemSet?: string;
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

export const defaultPtaNode: IPtaNode = {
    dashID: 0,
    pID: "",
    psID: "",
    title: "",
    label: "",
    type: PtaNodeType.ProblemSet,
    value: {
        summaries: {
            PROGRAMMING: {
                total: 0,
                totalScore: 0
            },
            CODE_COMPLETION: {
                total: 0,
                totalScore: 0
            },
            MULTIPLE_FILE: {
                total: 0,
                totalScore: 0
            }
        },
        total: 0,
        page: 0,
        limit: 0,
        problemSet: "",
        problemTotal: 0,
        problemType: ProblemType.PROGRAMMING,
        problemInfo: undefined
    },
    isFavorite: false,
    state: ProblemSubmissionState.PROBLEM_NO_ANSWER,
    score: 0,
    tag: [] as string[],
    locked: false
};

export type CallBack<T> = (msg: string, data?: T) => void;

export const solutionStatusMapping: Map<string, string> = new Map([
    ["OVERRIDDEN", "<td>已被覆盖</td>"],
    ["WAITING", "<td>等待评测</td>"],
    ["JUDGING", "<td style='color: orange;'>正在评测</td>"],
    ["COMPILE_ERROR", "<td style='color: #237aff;'>编译错误</td>"],
    ["ACCEPTED", "<td style='color: #ff5555;'>答案正确</td>"],
    ["PARTIAL_ACCEPTED", "<td style='color: #00b000;'>部分正确</td>"],
    ["PRESENTATION_ERROR", "<td style='color: #00b000;'>格式错误</td>"],
    ["WRONG_ANSWER", "<td style='color: #00b000;'>答案错误</td>"],
    ["MULTIPLE_ERROR", "<td style='color: #00b000;'>多种错误</td>"],
    ["TIME_LIMIT_EXCEEDED", "<td style='color: #00b000;'>运行超时</td>"],
    ["MEMORY_LIMIT_EXCEEDED", "<td style='color: #00b000;'>内存超限</td>"],
    ["NON_ZERO_EXIT_CODE", "<td style='color: #00b000;'>非零返回</td>"],
    ["SEGMENTATION_FAULT", "<td style='color: #00b000;'>段错误</td>"],
    ["FLOAT_POINT_EXCEPTION", "<td style='color: #00b000;'>浮点错误</td>"],
    ["OUTPUT_LIMIT_EXCEEDED", "<td style='color: #00b000;'>输出超限</td>"],
    ["INTERNAL_ERROR", "<td>内部错误</td>"],
    ["RUNTIME_ERROR", "<td style='color: #00b000;'>运行时错误</td>"],
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
    ["SQL (SQL)", "SQL"]
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
    ["SQL", "SQL (SQL)"]
]);

export const commentFormatMapping: Map<string, { single: string, start: string, middle: string, end: string }> = new Map([
    ["C++ (g++)", { single: "// ", start: "/* ", middle: " * ", end: " */" }],
    ["Python (python2)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
    ["Python (python3)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
    ["Python (pypy3)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
    ["Bash (bash)", { single: "# ", start: "# ", middle: "# ", end: "" }],
]);

export const problemTypeInfoMapping: Map<string, {
    name: string,
    type: number,
    prefix: string
}> = new Map([
    ["PROGRAMMING", { name: "编程题", type: 7, prefix: "programming" }],
    ["CODE_COMPLETION", { name: "函数题", type: 6, prefix: "codeCompletion" }],
    ["MULTIPLE_FILE", { name: "多文件编程题", type: 9, prefix: "multipleFile" }],
]);

export const colorThemeMapping: Map<string, string[]> = new Map([
    ["atom-one", ["atom-one-light.min.css", "atom-one-dark.min.css"]],
    ["github", ["github.min.css", "github-dark.min.css"]],
    ["a11y", ["a11y-light.min.css", "a11y-dark.min.css"]],
    ["stackoverflow", ["stackoverflow-light.min.css", "stackoverflow-dark.min.css"]],
    ["kimbie", ["kimbie-light.min.css", "kimbie-dark.min.css"]]
]);

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
        version: ""
    },
    GCC: {
        name: "GCC",
        ordinal: 1,
        ext: "c",
        language: "C",
        displayName: "gcc",
        version: "11.4.0",
        compileCmd: "gcc -DONLINE_JUDGE -fno-tree-ch -O2 -Wall -std=c99 -pipe $src -lm -o $exe"
    },
    GXX: {
        name: "GXX",
        ordinal: 2,
        ext: "cpp",
        language: "C++",
        displayName: "g++",
        version: "11.4.0",
        compileCmd: "g++ -DONLINE_JUDGE -fno-tree-ch -O2 -Wall -std=c++17 -pipe $src -lm -o $exe"
    },
    CLANG: {
        name: "CLANG",
        ordinal: 3,
        ext: "clang.c",
        language: "C",
        displayName: "clang",
        version: "17.0.6",
        compileCmd: "clang -DONLINE_JUDGE -O2 -Wall -std=c99 -pipe $src -lm -o $exe"
    },
    CLANGXX: {
        name: "CLANGXX",
        ordinal: 4,
        ext: "clang.cpp",
        language: "C++",
        displayName: "clang++",
        version: "17.0.6",
        compileCmd: "clang++ -DONLINE_JUDGE -O2 -Wall -std=c++17 -pipe $src -lm -o $exe"
    },
    JAVAC: {
        name: "JAVAC",
        ordinal: 5,
        ext: "java",
        language: "Java",
        displayName: "javac",
        version: "11.0.19",
        compileCmd: "javac -encoding UTF8 $src",
        runCmd: "java Main"
    },
    PYTHON2: {
        name: "PYTHON2",
        ordinal: 6,
        ext: "py",
        language: "Python",
        displayName: "python2",
        version: "2.7.17",
        runCmd: "python2 $src"
    },
    PYTHON3: {
        name: "PYTHON3",
        ordinal: 7,
        ext: "3.py",
        language: "Python",
        displayName: "python3",
        version: "3.10.13",
        runCmd: "python3 $src"
    },
    RUBY: {
        name: "RUBY",
        ordinal: 8,
        ext: "rb",
        language: "Ruby",
        displayName: "ruby",
        version: "2.7.5",
        runCmd: "ruby $src"
    },
    BASH: {
        name: "BASH",
        ordinal: 9,
        ext: "sh",
        language: "Bash",
        displayName: "bash",
        version: "4.4.20",
        runCmd: "bash $src"
    },
    CAT: {
        name: "CAT",
        ordinal: 10,
        ext: "txt",
        language: "Plaintext",
        displayName: "cat",
        version: "1.0",
        runCmd: "cat $src"
    },
    CLISP: {
        name: "CLISP",
        ordinal: 11,
        ext: "cl",
        language: "Common Lisp",
        displayName: "sbcl",
        version: "1.4.5",
        runCmd: "sbcl --script $src"
    },
    FPC: {
        name: "FPC",
        ordinal: 12,
        ext: "pas",
        language: "Pascal",
        displayName: "fpc",
        version: "3.0.4",
        compileCmd: "fpc -dONLINE_JUDGE -O2 $src"
    },
    GO: {
        name: "GO",
        ordinal: 13,
        ext: "go",
        language: "Go",
        displayName: "go",
        version: "1.20.3",
        compileCmd: "go build $src"
    },
    GHC: {
        name: "GHC",
        ordinal: 14,
        ext: "hs",
        language: "Haskell",
        displayName: "ghc",
        version: "8.4.3",
        compileCmd: "ghc -v0 -O2 --make -threaded $src -o $exe"
    },
    LUA: {
        name: "LUA",
        ordinal: 15,
        ext: "lua",
        language: "Lua",
        displayName: "lua",
        version: "5.2.4",
        runCmd: "lua $src"
    },
    LUAJIT: {
        name: "LUAJIT",
        ordinal: 16,
        ext: "jit.lua",
        language: "Lua",
        displayName: "luajit",
        version: "2.1.0",
        runCmd: "luajit $src"
    },
    MCS: {
        name: "MCS",
        ordinal: 17,
        ext: "cs",
        language: "C#",
        displayName: "dotnet",
        version: "6.0.413",
        compileCmd: "dotnet build",
        runCmd: "$exe"
    },
    NODE: {
        name: "NODE",
        ordinal: 18,
        ext: "js",
        language: "JavaScript",
        displayName: "node",
        version: "12.22.12",
        runCmd: "node $src"
    },
    OCAMLC: {
        name: "OCAMLC",
        ordinal: 19,
        ext: "ml",
        language: "OCaml",
        displayName: "ocamlc",
        version: "4.05.0",
        compileCmd: "ocamlc -unsafe $src -o $exe"
    },
    PHP: {
        name: "PHP",
        ordinal: 20,
        ext: "php",
        language: "PHP",
        displayName: "php",
        version: "7.2.24",
        runCmd: "php $src"
    },
    PERL: {
        name: "PERL",
        ordinal: 21,
        ext: "pl",
        language: "Perl",
        displayName: "perl",
        version: "5.26.1",
        runCmd: "perl $src"
    },
    AWK: {
        name: "AWK",
        ordinal: 22,
        ext: "awk",
        language: "AWK",
        displayName: "awk",
        version: "4.1.4",
        runCmd: "awk -f $src"
    },
    DMD: {
        name: "DMD",
        ordinal: 23,
        ext: "d",
        language: "D",
        displayName: "dmd",
        version: "2.074.1",
        compileCmd: "dmd -O $src -of$exe"
    },
    RKT: {
        name: "RKT",
        ordinal: 24,
        ext: "rkt",
        language: "Racket",
        displayName: "racket",
        version: "6.11",
        compileCmd: "raco make $src",
        runCmd: "racket $src"
    },
    VALAC: {
        name: "VALAC",
        ordinal: 25,
        ext: "vala",
        language: "Vala",
        displayName: "valac",
        version: "0.40.23",
        compileCmd: "valac -D ONLINE_JUDGE --thread $src -o $exe"
    },
    VBNC: {
        name: "VBNC",
        ordinal: 26,
        ext: "vb",
        language: "Visual Basic",
        displayName: "dotnet",
        version: "6.0.413",
        compileCmd: "dotnet build",
        runCmd: "$exe"
    },
    KOTLIN: {
        name: "KOTLIN",
        ordinal: 27,
        ext: "kt",
        language: "Kotlin",
        displayName: "kotlinc",
        version: "1.6.21",
        compileCmd: "kotlinc $src -include-runtime -d Main.jar",
        runCmd: "java -jar Main.jar"
    },
    SWIFT: {
        name: "SWIFT",
        ordinal: 28,
        ext: "swift",
        language: "Swift",
        displayName: "swiftc",
        version: "4.2.4",
        compileCmd: "swiftc $src -O -o $exe"
    },
    OBJC: {
        name: "OBJC",
        ordinal: 29,
        ext: "m",
        language: "Objective-C",
        displayName: "clang",
        version: "17.0.6",
        compileCmd: "clang $src -MMD -MP -DGNUSTEP -DGNUSTEP_BASE_LIBRARY=1 -DGNU_GUI_LIBRARY=1 -DGNU_RUNTIME=1 -fno-strict-aliasing -fexceptions -fobjc-exceptions -D_NATIVE_OBJC_EXCEPTIONS -pthread -fPIC -Wall -DGSWARN -DGSDIAGNOSE -Wno-import -g -O2 -fgnu-runtime -fconstant-string-class=NSConstantString -fexec-charset=UTF-8 -I. -I/home/judger/GNUstep/Library/Headers -I/usr/local/include/GNUstep -I/usr/include/GNUstep -rdynamic -shared-libgcc -lgnustep-base -lobjc -lm -o $exe"
    },
    FORTRAN: {
        name: "FORTRAN",
        ordinal: 30,
        ext: "f95",
        language: "Fortran95",
        displayName: "gfortran",
        version: "7.5.0",
        compileCmd: "gfortran $src"
    },
    OCTAVE: {
        name: "OCTAVE",
        ordinal: 31,
        ext: "octave",
        language: "Octave",
        displayName: "octave-cli",
        version: "4.2.2",
        runCmd: "octave-cli --no-gui --no-history --no-init-file --no-init-path --no-line-editing --no-site-file --no-window-system --norc $src"
    },
    RLANG: {
        name: "RLANG",
        ordinal: 32,
        ext: "r",
        language: "R",
        displayName: "R",
        version: "3.6.3",
        runCmd: "R --slave --vanilla -f $src"
    },
    ASM: {
        name: "ASM",
        ordinal: 33,
        ext: "asm",
        language: "ASM",
        displayName: "nasm.sh",
        version: "2.13.02",
        compileCmd: "nasm.sh $src $exe"
    },
    RUST: {
        name: "RUST",
        ordinal: 34,
        ext: "rs",
        language: "Rust",
        displayName: "rustc",
        version: "1.79.0",
        compileCmd: "rustc --edition=2018 -O --cfg ONLINE_JUDGE $src -o $exe"
    },
    SCALA: {
        name: "SCALA",
        ordinal: 35,
        ext: "scala",
        language: "Scala",
        displayName: "scalac",
        version: "2.13.8",
        compileCmd: "scalac -encoding UTF8 $src",
        runCmd: `java -Xbootclasspath/a:/usr/share/scala/lib/jline-3.16.0.jar:/usr/share/scala/lib/jna-5.3.1.jar:/usr/share/scala/lib/scala-compiler.jar:/usr/share/scala/lib/scala-library.jar:/usr/share/scala/lib/scala-reflect.jar:/usr/share/scala/lib/scalap-2.13.4.jar -classpath '""' -Dscala.boot.class.path=/usr/share/scala/lib/jline-3.16.0.jar:/usr/share/scala/lib/jna-5.3.1.jar:/usr/share/scala/lib/scala-compiler.jar:/usr/share/scala/lib/scala-library.jar:/usr/share/scala/lib/scala-reflect.jar:/usr/share/scala/lib/scalap-2.13.4.jar -Dscala.home=/usr/share/scala -Dscala.usejavacp=true scala.tools.nsc.MainGenericRunner Main`
    },
    PYPY3: {
        name: "PYPY3",
        ordinal: 36,
        ext: "pypy.3.py",
        language: "Python",
        displayName: "pypy3",
        version: "3.9.19",
        runCmd: "pypy3 $src"
    },
    CANGJIE: {
        name: "CANGJIE",
        ordinal: 37,
        ext: "cj",
        language: "仓颉",
        displayName: "cjc",
        version: "0.53.4",
        runCmd: "cjc $src",
        compileCmd: "cjc --cfg ENV=ONLINE_JUDGE -O2 -Won all --error-count-limit 10 $src -o $exe"
    },
    SQL: {
        name: "SQL",
        ordinal: 100,
        isHidden: !0,
        ext: "sql",
        language: "SQL",
        displayName: "SQL",
        version: ""
    }
};