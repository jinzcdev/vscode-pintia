
const tm = require('markdown-it-texmath');
export const markdownEngine = require('markdown-it')({ html: true })
    .use(tm, {
        engine: require('katex'),
        delimiters: 'dollars',
        katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
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

