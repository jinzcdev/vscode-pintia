import { pinyin } from 'pinyin-pro';

/**
 * 将中文字符转换为拼音，并将中文标点符号转换为英文标点
 * @param text 包含中文的字符串
 * @param separator 拼音之间的分隔符, 默认为'-'
 * @returns 转换后的字符串
 */
export function convertChineseCharacters(text: string, separator: string = '-'): string {
    if (!text) {
        return '';
    }

    // 中文标点符号与英文标点符号的映射
    const punctuationMap: Record<string, string> = {
        '，': ',', '。': '.', '；': ';', '：': ':', '？': '?', '！': '!',
        '"': '"', '（': '(', '）': ')', '【': '[', '】': ']', '《': '<', '》': '>',
        '—': '-', '～': '~', '「': '[', '」': ']', '『': '[', '』': ']', '・': '.',
        '…': '...', '‥': '..', '〈': '<', '〉': '>', '＿': '_', '＆': '&',
        '＃': '#', '％': '%', '＊': '*', '＋': '+', '｜': '|', '／': '/',
        '＼': '\\', '￥': '$', '、': ',', '·': '.', '〃': '"', '〔': '(',
        '〕': ')', '〖': '[', '〗': ']', '〝': '"', '〞': '"', '｛': '{',
        '｝': '}', '–': '-', '﹏': '_'
    };

    for (const [chinese, english] of Object.entries(punctuationMap)) {
        text = text.replace(new RegExp(chinese, 'g'), english);
    }

    if (!/[\u4e00-\u9fa5]/.test(text)) {
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
