/**
 * Check if a string is blank (empty or contains only whitespace)
 * @param value string to check
 * @param defaultValue default value to return if value is blank
 * @returns value if not blank, defaultValue otherwise
 */
export function defaultIfBlank(value: string | undefined, defaultValue: string): string {
    return !value || value.trim() === "" ? defaultValue : value;
}

/**
 * 文件名/文件夹名中的非法字符：Windows 保留字符集 + 控制字符。
 *
 * 两个字面量是刻意的：带 `g` 的正则用在 `test()` 上会保留 `lastIndex` 状态，
 * 导致相邻两次判断结果交替出错；`replace` 则需要 `g`。
 */
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
const INVALID_FILE_NAME_CHARS_GLOBAL = /[<>:"/\\|?*\u0000-\u001f]/g;

/** 非法字符的默认替换符 */
export const DEFAULT_INVALID_CHAR_REPLACEMENT = "_";

/**
 * 将文件名/文件夹名中的非法字符替换为 `replacement`（空串表示删除这些字符）。
 *
 * `replacement` 来自用户配置，因此这里做了两层防护：
 * 1. 若它自身含非法字符或空白，回退为默认的 `_`——否则等于把非法字符又放回去；
 * 2. 用函数式替换而非字符串替换——否则 `$&`、`$1`、``$` `` 会被 `String.replace` 特殊解释。
 * @param value 原始名称
 * @param replacement 替换符，默认 `_`
 * @returns 净化后的名称
 */
export function sanitizeFileName(value: string, replacement: string = DEFAULT_INVALID_CHAR_REPLACEMENT): string {
    if (!value) {
        return "";
    }
    // 空串是合法的「删除」模式；其余含非法字符或空白的一律回退
    const usableReplacement =
        replacement === "" || (!/\s/.test(replacement) && !INVALID_FILE_NAME_CHARS.test(replacement));
    const effective = usableReplacement ? replacement : DEFAULT_INVALID_CHAR_REPLACEMENT;

    return value.replace(INVALID_FILE_NAME_CHARS_GLOBAL, () => effective);
}

/**
 * Check if a string is valid file name
 * @param value string to check
 * @returns true if value is a valid file name, false otherwise
 */
export function isValidFileName(value: string): boolean {
    if (!value || value.trim() === "") {
        return false;
    }
    return !INVALID_FILE_NAME_CHARS.test(value);
}
