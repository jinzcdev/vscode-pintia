import { pinyin } from 'pinyin-pro';

/**
 * 转换中文字符为拼音
 * @param text 包含中文的字符串
 * @param separator 拼音之间的分隔符, 默认为'-'
 * @returns 转换后的拼音字符串，只将连续的中文转为拼音
 */
export function convertChineseToPinyin(text: string, separator: string = '-'): string {
    if (!text || !/[\u4e00-\u9fa5]/.test(text)) {
        return text;
    }

    const chinesePattern = /([\u4e00-\u9fa5]+)/g;

    return text.replace(chinesePattern, (match) => {
        return pinyin(match, {
            toneType: 'none',
            type: 'string',
            separator: separator
        }).toLowerCase();
    });
}