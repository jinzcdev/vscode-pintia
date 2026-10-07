import * as path from "path";
import { convertChineseCharacters } from "./chineseUtils";
import { defaultIfBlank, isValidFileName, sanitizeFileName } from "./stringUtils";

/**
 * 生成题目源文件路径所需的全部输入。
 *
 * 刻意做成纯数据 + 纯函数：路径的拼接顺序本身就是 issue #25 的根因
 * （净化曾经发生在中文转写之前，而转写会把全角标点变回 `/` 等非法字符），
 * 抽出来才能直接单测顺序，而不必去 stub `fs` 与 `vscode.window`。
 */
export interface IProblemFilePathOptions {
    /** 工作区目录 */
    workspaceFolder: string;
    /** `pintia.file.problemFileNameFormat` */
    problemFileNameFormat: string;
    label?: string;
    title?: string;
    pID: string;
    psID: string;
    /** 编译器对应的文件扩展名（不含点） */
    ext: string;
    /** 题集名称；未开启自动创建题集文件夹时可为空 */
    psName?: string;
    /** `pintia.autoCreateProblemSetFolder` */
    autoCreateProblemSetFolder: boolean;
    /** `pintia.file.customProblemSetName`（psID → 自定义名） */
    customProblemSetName: Record<string, string>;
    /** `pintia.file.replaceSpaceWithUnderscore` */
    replaceSpaceWithUnderscore: boolean;
    /** `pintia.file.convertChineseCharacters` */
    convertChineseCharacters: boolean;
    /** `pintia.file.invalidCharReplacement` */
    invalidCharReplacement: string;
}

export interface IProblemFilePathResult {
    filePath: string;
    /** 自定义题集名含非法字符并已回退到默认名；调用方据此提示用户 */
    customProblemSetNameInvalid: boolean;
}

/**
 * 净化并去空白；若结果为空（或恰好是 `.` / `..`，会导致向上越目录），
 * 改用不会出错的 id 兜底，避免生成隐藏的 `.cpp` 或跑到工作区之外。
 */
function normalizeName(name: string, fallbackId: string, replacement: string): string {
    const normalized = sanitizeFileName(name.trim(), replacement).trim();
    if (!normalized || normalized === "." || normalized === "..") {
        return defaultIfBlank(sanitizeFileName(fallbackId, replacement), "problem");
    }
    return normalized;
}

/**
 * 组装题目源文件路径。
 *
 * 顺序很关键：占位符替换 → 空格替换 → 中文转写 → **非法字符净化** → 去空白。
 * 净化必须排在所有转换之后，否则 `convertChineseCharacters` 映射出的 `/ \ : ? < > * | "`
 * 会绕开净化直接进入路径（这正是 issue #25 的现象之一）。
 */
export function resolveProblemFilePath(options: IProblemFilePathOptions): IProblemFilePathResult {
    const replacement = options.invalidCharReplacement;
    const convert = (value: string): string =>
        options.convertChineseCharacters ? convertChineseCharacters(value) : value;

    let fileName = options.problemFileNameFormat
        .replace(/{label}/g, options.label ?? "")
        .replace(/{title}/g, options.title ?? "")
        .replace(/{pid}/g, options.pID)
        .replace(/{psid}/g, options.psID);
    if (options.replaceSpaceWithUnderscore) {
        fileName = fileName.replace(/\s+/g, "_");
    }
    fileName = normalizeName(convert(fileName), options.pID, replacement);

    let customProblemSetNameInvalid = false;
    let psName = "";
    if (options.autoCreateProblemSetFolder && options.psName) {
        const customName = options.customProblemSetName[options.psID];
        if (customName && isValidFileName(customName)) {
            // 自定义名是用户显式输入的字面量，不参与中文转写
            psName = customName;
        } else {
            customProblemSetNameInvalid = !!customName;
            psName = convert(options.psName);
        }
        psName = normalizeName(psName, options.psID, replacement);
    }

    const fileNameWithExt = `${fileName}.${options.ext}`;
    return {
        filePath: psName
            ? path.join(options.workspaceFolder, psName, fileNameWithExt)
            : path.join(options.workspaceFolder, fileNameWithExt),
        customProblemSetNameInvalid,
    };
}
