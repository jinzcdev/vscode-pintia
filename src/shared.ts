import { IProblemSummary } from "./entity/ProblemSummary";

import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { IProblemInfo } from "./entity/ProblemInfo";

export const configPath: string = path.join(os.homedir(), ".pintia");
export const cacheFilePath: string = path.join(configPath, "cache");


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
    ["CommonLisp  (sbcl)", "CLISP"],
    ["Pascal (fpc)", "FPC"],
    ["Go (go)", "GO"],
    ["Haskell (ghc)", "GHC"],
    ["Lua (lua)", "LUA"],
    ["Lua (luajit)", "LUAJIT"],
    ["C# (mcs)", "MCS"],
    ["JavaScript (node)", "NODE"],
    ["OCaml (ocamlc)", "OCAMLC"],
    ["PHP (php)", "PHP"],
    ["Perl (perl)", "PERL"],
    ["AWK (awk)", "AWK"],
    ["D (dmd)", "DMD"],
    ["Racket (racket)", "RKT"],
    ["Vala (valac)", "VALAC"],
    ["Visual Basic (vbnc)", "VBNC"],
    ["Kotlin (kotlinc)", "KOTLIN"],
    ["Swift (swiftc)", "SWIFT"],
    ["Objective-C (gcc)", "OBJC"],
    ["Fortran95 (gfortran)", "FORTRAN"],
    ["Octave (octave-cli)", "OCTAVE"],
    ["R (R)", "RLANG"],
    ["ASM (nasm.sh)", "ASM"],
    ["Rust (rustc)", "RUST"],
    ["Scala (scalac)", "SCALA"],
    ["Python (pypy3)", "PYPY3"],
    ["SQL (SQL)", "SQL"]
]);

export const compilerLangMapping: Map<string, string> = new Map([
    ["NO_COMPILER", ""],
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
    ["CLISP", "CommonLisp  (sbcl)"],
    ["FPC", "Pascal (fpc)"],
    ["GO", "Go (go)"],
    ["GHC", "Haskell (ghc)"],
    ["LUA", "Lua (lua)"],
    ["LUAJIT", "Lua (luajit)"],
    ["MCS", "C# (mcs)"],
    ["NODE", "JavaScript (node)"],
    ["OCAMLC", "OCaml (ocamlc)"],
    ["PHP", "PHP (php)"],
    ["PERL", "Perl (perl)"],
    ["AWK", "AWK (awk)"],
    ["DMD", "D (dmd)"],
    ["RKT", "Racket (racket)"],
    ["VALAC", "Vala (valac)"],
    ["VBNC", "Visual Basic (vbnc)"],
    ["KOTLIN", "Kotlin (kotlinc)"],
    ["SWIFT", "Swift (swiftc)"],
    ["OBJC", "Objective-C (gcc)"],
    ["FORTRAN", "Fortran95 (gfortran)"],
    ["OCTAVE", "Octave (octave-cli)"],
    ["RLANG", "R (R)"],
    ["ASM", "ASM (nasm.sh)"],
    ["RUST", "Rust (rustc)"],
    ["SCALA", "Scala (scalac)"],
    ["PYPY3", "Python (pypy3)"],
    ["SQL", "SQL (SQL)"]
]);

export const commentFormatMapping: Map<string, { single: string, start: string, middle: string, end: string }> = new Map([
    ["C++ (g++)", { single: "// ", start: "/* ", middle: " * ", end: " */" }],
    ["Python (python2)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
    ["Python (python3)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
    ["Python (pypy3)", { single: "# ", start: "'''", middle: "   ", end: "'''" }],
    ["Bash (bash)", { single: "# ", start: "# ", middle: "# ", end: "" }],
]);

export const problemTypeNameMapping: Map<string, string> = new Map([
    ["PROGRAMMING", "编程题"],
    ["CODE_COMPLETION", "函数题"],
    ["MULTIPLE_FILE", "多文件编程题"]
]);

export enum DescriptionConfiguration {
    InWebView = "In Webview",
    InFileComment = "In File Comment",
    Both = "Both",
    None = "None",
}

export const ptaCompiler = {
    NO_COMPILER: {
        name: "NO_COMPILER",
        ordinal: 0,
        mime: "text/plain",
        isHidden: !0,
        ext: "",
        language: "",
        displayName: "",
        version: ""
    },
    GCC: {
        name: "GCC",
        ordinal: 1,
        mime: "text/x-csrc",
        ext: "c",
        language: "C",
        displayName: "gcc",
        version: "6.5.0",
        compileCmd: "gcc -DONLINE_JUDGE -fno-tree-ch -O2 -Wall -std=c99 -pipe $src -lm -o $exe"
    },
    GXX: {
        name: "GXX",
        ordinal: 2,
        mime: "text/x-c++src",
        ext: "cpp",
        language: "C++",
        displayName: "g++",
        version: "6.5.0",
        compileCmd: "g++ -DONLINE_JUDGE -fno-tree-ch -O2 -Wall -std=c++17 -pipe $src -lm -o $exe"
    },
    CLANG: {
        name: "CLANG",
        ordinal: 3,
        mime: "text/x-csrc",
        ext: "clang.c",
        language: "C",
        displayName: "clang",
        version: "6.0.0",
        compileCmd: "clang -DONLINE_JUDGE -O2 -Wall -std=c99 -pipe $src -lm -o $exe"
    },
    CLANGXX: {
        name: "CLANGXX",
        ordinal: 4,
        mime: "text/x-c++src",
        ext: "clang.cpp",
        language: "C++",
        displayName: "clang++",
        version: "6.0.0",
        compileCmd: "clang++ -DONLINE_JUDGE -O2 -Wall -std=c++17 -pipe $src -lm -o $exe"
    },
    JAVAC: {
        name: "JAVAC",
        ordinal: 5,
        mime: "text/x-java",
        ext: "java",
        language: "Java",
        displayName: "javac",
        version: "1.8.0",
        compileCmd: "javac -encoding UTF8 $src",
        runCmd: "java Main"
    },
    PYTHON2: {
        name: "PYTHON2",
        ordinal: 6,
        mime: "text/x-python",
        ext: "py",
        language: "Python",
        displayName: "python2",
        version: "2.7.17",
        runCmd: "python2 $src"
    },
    PYTHON3: {
        name: "PYTHON3",
        ordinal: 7,
        mime: "text/x-python",
        ext: "3.py",
        language: "Python",
        displayName: "python3",
        version: "3.7.11",
        runCmd: "python3 $src"
    },
    RUBY: {
        name: "RUBY",
        ordinal: 8,
        mime: "text/x-ruby",
        ext: "rb",
        language: "Ruby",
        displayName: "ruby",
        version: "2.7.1",
        runCmd: "ruby $src"
    },
    BASH: {
        name: "BASH",
        ordinal: 9,
        mime: "text/x-sh",
        ext: "sh",
        language: "Bash",
        displayName: "bash",
        version: "4.4.20",
        runCmd: "bash $src"
    },
    CAT: {
        name: "CAT",
        ordinal: 10,
        mime: "text/plain",
        ext: "txt",
        language: "Plaintext",
        displayName: "cat",
        version: "1.0",
        runCmd: "cat $src"
    },
    CLISP: {
        name: "CLISP",
        ordinal: 11,
        mime: "text/x-common-lisp",
        ext: "cl",
        language: "Common Lisp",
        displayName: "sbcl",
        version: "1.4.5",
        runCmd: "sbcl --script $src"
    },
    FPC: {
        name: "FPC",
        ordinal: 12,
        mime: "text/x-pascal",
        ext: "pas",
        language: "Pascal",
        displayName: "fpc",
        version: "3.0.4",
        compileCmd: "fpc -dONLINE_JUDGE -O2 $src"
    },
    GO: {
        name: "GO",
        ordinal: 13,
        mime: "text/x-go",
        ext: "go",
        language: "Go",
        displayName: "go",
        version: "1.9.4",
        compileCmd: "go build $src"
    },
    GHC: {
        name: "GHC",
        ordinal: 14,
        mime: "text/x-haskell",
        ext: "hs",
        language: "Haskell",
        displayName: "ghc",
        version: "8.4.3",
        compileCmd: "ghc -v0 -O2 --make -threaded $src -o $exe"
    },
    LUA: {
        name: "LUA",
        ordinal: 15,
        mime: "text/x-lua",
        ext: "lua",
        language: "Lua",
        displayName: "lua",
        version: "5.2.4",
        runCmd: "lua $src"
    },
    LUAJIT: {
        name: "LUAJIT",
        ordinal: 16,
        mime: "text/x-lua",
        ext: "jit.lua",
        language: "Lua",
        displayName: "luajit",
        version: "2.1.0",
        runCmd: "luajit $src"
    },
    MCS: {
        name: "MCS",
        ordinal: 17,
        mime: "text/x-csharp",
        ext: "cs",
        language: "C#",
        displayName: "mcs",
        version: "4.6.2.0",
        compileCmd: "mcs -debug- -optimize+ -define:ONLINE_JUDGE $src",
        runCmd: "mono -O=all $exe"
    },
    NODE: {
        name: "NODE",
        ordinal: 18,
        mime: "text/javascript",
        ext: "js",
        language: "JavaScript",
        displayName: "node",
        version: "12.22.1",
        runCmd: "node $src"
    },
    OCAMLC: {
        name: "OCAMLC",
        ordinal: 19,
        mime: "text/x-ocaml",
        ext: "ml",
        language: "OCaml",
        displayName: "ocamlc",
        version: "4.05.0",
        compileCmd: "ocamlc -unsafe $src -o $exe"
    },
    PHP: {
        name: "PHP",
        ordinal: 20,
        mime: "text/x-php",
        ext: "php",
        language: "PHP",
        displayName: "php",
        version: "7.2.24",
        runCmd: "php $src"
    },
    PERL: {
        name: "PERL",
        ordinal: 21,
        mime: "text/x-perl",
        ext: "pl",
        language: "Perl",
        displayName: "perl",
        version: "5.26.1",
        runCmd: "perl $src"
    },
    AWK: {
        name: "AWK",
        ordinal: 22,
        mime: "text/plain",
        ext: "awk",
        language: "AWK",
        displayName: "awk",
        version: "4.1.4",
        runCmd: "awk -f $src"
    },
    DMD: {
        name: "DMD",
        ordinal: 23,
        mime: "text/x-d",
        ext: "d",
        language: "D",
        displayName: "dmd",
        version: "2.074.1",
        compileCmd: "dmd -O $src -of$exe"
    },
    RKT: {
        name: "RKT",
        ordinal: 24,
        mime: "text/plain",
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
        mime: "text/plain",
        ext: "vala",
        language: "Vala",
        displayName: "valac",
        version: "0.40.23",
        compileCmd: "valac -D ONLINE_JUDGE --thread $src -o $exe"
    },
    VBNC: {
        name: "VBNC",
        ordinal: 26,
        mime: "text/x-vb",
        ext: "vb",
        language: "Visual Basic",
        displayName: "vbnc",
        version: "0.0.0.5943",
        compileCmd: "vbnc2 /libpath:/usr/lib/mono/4.5 $src",
        runCmd: "mono -O=all $exe"
    },
    KOTLIN: {
        name: "KOTLIN",
        ordinal: 27,
        mime: "text/x-kotlin",
        ext: "kt",
        language: "Kotlin",
        displayName: "kotlinc",
        version: "1.5.10",
        compileCmd: "kotlinc $src -include-runtime -d Main.jar",
        runCmd: "java -jar Main.jar"
    },
    SWIFT: {
        name: "SWIFT",
        ordinal: 28,
        mime: "text/x-swift",
        ext: "swift",
        language: "Swift",
        displayName: "swiftc",
        version: "4.2.4",
        compileCmd: "swiftc $src -O -o $exe"
    },
    OBJC: {
        name: "OBJC",
        ordinal: 29,
        mime: "text/x-objectivec",
        ext: "m",
        language: "Objective-C",
        displayName: "gcc",
        version: "7.5.0",
        compileCmd: "gcc $src -MMD -MP -DGNUSTEP -DGNUSTEP_BASE_LIBRARY=1 -DGNU_GUI_LIBRARY=1 -DGNU_RUNTIME=1 -DGNUSTEP_BASE_LIBRARY=1 -fno-strict-aliasing -fexceptions -fobjc-exceptions -D_NATIVE_OBJC_EXCEPTIONS -pthread -fPIC -Wall -DGSWARN -DGSDIAGNOSE -Wno-import -g -O2 -fgnu-runtime -fconstant-string-class=NSConstantString -fexec-charset=UTF-8 -I. -I/home/judger/GNUstep/Library/Headers -I/usr/local/include/GNUstep -I/usr/include/GNUstep -o $exe"
    },
    FORTRAN: {
        name: "FORTRAN",
        ordinal: 30,
        mime: "text/x-fortran",
        ext: "f95",
        language: "Fortran95",
        displayName: "gfortran",
        version: "7.5.0",
        compileCmd: "gfortran $src"
    },
    OCTAVE: {
        name: "OCTAVE",
        ordinal: 31,
        mime: "text/x-octave",
        ext: "octave",
        language: "Octave",
        displayName: "octave-cli",
        version: "4.2.2",
        runCmd: "octave-cli --no-gui --no-history --no-init-file --no-init-path --no-line-editing --no-site-file --no-window-system --norc $src"
    },
    RLANG: {
        name: "RLANG",
        ordinal: 32,
        mime: "text/x-rsrc",
        ext: "r",
        language: "R",
        displayName: "R",
        version: "3.6.3",
        runCmd: "R --slave --vanilla -f $src"
    },
    ASM: {
        name: "ASM",
        ordinal: 33,
        mime: "text/plain",
        ext: "asm",
        language: "ASM",
        displayName: "nasm.sh",
        version: "2.13.02",
        compileCmd: "nasm.sh $src $exe"
    },
    RUST: {
        name: "RUST",
        ordinal: 34,
        mime: "text/x-rustsrc",
        ext: "rs",
        language: "Rust",
        displayName: "rustc",
        version: "1.53.0",
        compileCmd: "rustc --edition=2018 -O --cfg ONLINE_JUDGE $src -o $exe"
    },
    SCALA: {
        name: "SCALA",
        ordinal: 35,
        mime: "text/x-scala",
        ext: "scala",
        language: "Scala",
        displayName: "scalac",
        version: "2.13.4",
        compileCmd: "scalac -encoding UTF8 $src",
        runCmd: "java -Xbootclasspath/a:/usr/share/scala/lib/jline-3.16.0.jar:/usr/share/scala/lib/jna-5.3.1.jar:/usr/share/scala/lib/scala-compiler.jar:/usr/share/scala/lib/scala-library.jar:/usr/share/scala/lib/scala-reflect.jar:/usr/share/scala/lib/scalap-2.13.4.jar -classpath '\"\"' -Dscala.boot.class.path=/usr/share/scala/lib/jline-3.16.0.jar:/usr/share/scala/lib/jna-5.3.1.jar:/usr/share/scala/lib/scala-compiler.jar:/usr/share/scala/lib/scala-library.jar:/usr/share/scala/lib/scala-reflect.jar:/usr/share/scala/lib/scalap-2.13.4.jar -Dscala.home=/usr/share/scala -Dscala.usejavacp=true scala.tools.nsc.MainGenericRunner Main"
    },
    PYPY3: {
        name: "PYPY3",
        ordinal: 36,
        mime: "text/x-python",
        ext: "3.py",
        language: "Python",
        displayName: "pypy3",
        version: "3.7",
        runCmd: "pypy3 $src"
    },
    SQL: {
        name: "SQL",
        ordinal: 100,
        mime: "text/x-sql",
        isHidden: !0,
        ext: "sql",
        language: "SQL",
        displayName: "SQL",
        version: ""
    }
}

