import { imgUrlPrefix } from "../shared";

const hljs = require('highlight.js');

export const markdownEngine = require('markdown-it')({
    html: true,
    linkify: true,
    highlight: function (str: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(str, { language: lang }).value;
            } catch (__) { }
        }
        return str;
    }
})
    .use(require('markdown-it-replace-link'), {
        replaceLink: function (link: string, env: any) {
            link = link.trim();
            if (link.startsWith("http")) {
                return link;
            }
            let i = link.length - 1
            while (i >= 0 && link[i] !== "/") i--;
            return `${imgUrlPrefix}/${link.substring(i + 1)}`;
        }
    });