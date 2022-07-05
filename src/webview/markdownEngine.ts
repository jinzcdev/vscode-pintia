
const tm = require('markdown-it-texmath');
export const markdown = require('markdown-it')({ html: true })
    .use(tm, {
        engine: require('katex'),
        delimiters: 'dollars',
        katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
    });

