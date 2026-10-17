import { imgUrlPrefix } from "../shared";
import { escapeHtml } from "../utils/stringUtils";

const hljs = require("highlight.js");
const markdownEngine = require("markdown-it")({
    html: true,
    linkify: true,
    breaks: true,
    typography: true,
    highlight: function (str: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch (__) {}
        }
        return str;
    },
})
    .use(require("@vscode/markdown-it-katex").default)
    .use(require("markdown-it-replace-link"), {
        replaceLink: function (link: string) {
            return processLink(link);
        },
    });

function processLink(link: string): string {
    link = link.trim();
    if (link.startsWith("http")) {
        return link;
    }
    let i = link.length - 1;
    while (i >= 0 && link[i] !== "/") i--;
    return `${imgUrlPrefix}/${link.substring(i + 1)}`;
}

/**
 * Render markdown to html
 * @param markdown
 * @returns
 */
export function render(markdown: string): string {
    markdown = markdown.replace(/\${2}(.+?)\${2}/g, (match: string, p1: string) =>
        require("katex").renderToString(p1, { throwOnError: false })
    );
    return markdownEngine
        .render(markdown)
        .replace(/!\[([^\]]*)\]\((.*?)\)/g, (_: string, alt: string, link: string) => {
            // alt 与 src 都要转义：原始 HTML 块里的图片不会被 markdown-it 处理，
            // 走到这里时内容里的引号会直接突破属性边界（如 alt="a"b"）
            return `<img alt="${escapeHtml(alt)}" src="${escapeHtml(processLink(link))}">`;
        });
}
