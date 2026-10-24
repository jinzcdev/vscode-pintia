import * as assert from "assert";
import { render } from "../../../src/webview/markdownEngine";
import { imgUrlPrefix } from "../../../src/shared";

describe("markdownEngine - render", () => {
    it("普通 markdown 应渲染为段落", () => {
        assert.strictEqual(render("hello").trim(), "<p>hello</p>");
    });

    it("$$...$$ 公式应渲染为 KaTeX 而非保留原文", () => {
        const html = render("公式 $$a+b$$");

        assert.ok(html.includes("katex"), "应包含 KaTeX 渲染结果");
        assert.ok(!html.includes("$$"), "不应残留 $$ 标记");
    });

    it("行内 $...$ 公式也应渲染为 KaTeX", () => {
        const html = render("求 $x^2$ 的值");

        assert.ok(html.includes("katex"));
        assert.ok(html.includes("x^2"), "应保留公式原文供 KaTeX 解析");
    });

    it("相对路径图片应补全为拼题A 图片域名", () => {
        const html = render("![alt](abc/def.png)");

        assert.ok(html.includes(`src="${imgUrlPrefix}/def.png"`), `实际输出: ${html}`);
    });

    it("绝对 URL 图片应保持原样", () => {
        const html = render("![alt](https://example.com/a.png)");

        assert.ok(html.includes('src="https://example.com/a.png"'), `实际输出: ${html}`);
    });

    it("代码块应做语法高亮", () => {
        const html = render("```cpp\nint main(){}\n```");

        assert.ok(html.includes("hljs-"), "应包含 highlight.js 的标记 span");
        assert.ok(html.includes("language-cpp"));
    });

    it("原始 HTML 块内图片的 alt 与 src 都应被转义", () => {
        // 这类图片不会被 markdown-it 处理，会直接走到 render() 的 replace 分支；
        // 不转义时内容里的引号会突破属性边界
        const html = render('<div>![a"b](https://x/y".png)</div>');

        assert.ok(!html.includes('alt="a"b"'), `alt 未转义: ${html}`);
        assert.ok(html.includes("&quot;"), `应转义引号: ${html}`);
    });
});
