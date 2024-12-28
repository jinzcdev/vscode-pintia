import { imgUrlPrefix } from "../shared";

const hljs = require('highlight.js');
const markdownEngine = require('markdown-it')({
    html: true,
    linkify: true,
    breaks: true,
    typography: true,
    highlight: function (str: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch (__) { }
        }
        return str;
    }
})
    .use(require('@vscode/markdown-it-katex').default)
    .use(require('markdown-it-replace-link'), {
        replaceLink: function (link: string, env: any) {
            return processLink(link);
        }
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
    markdown = markdown.replace(/\${2}(.+?)\${2}/g,
        (match: string, p1: string) => require("katex").renderToString(p1, { throwOnError: false })
    );
    return markdownEngine.render(markdown)
        .replace(/!\[([^\]]*)\]\((.*?)\)/g, (_: string, alt: string, link: string) => {
            return `<img alt="${alt}" src="${processLink(link)}">`;
        });
}