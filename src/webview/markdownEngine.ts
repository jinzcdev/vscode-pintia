
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
            if (link.includes("http")) {
                return link;
            }
            let i = link.length - 1
            while (i >= 0 && link[i] !== "/") i--;
            return "https://images.ptausercontent.com/" + link.substring(i + 1);
        }
    });

