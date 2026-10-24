import * as assert from "assert";
import { buildContentSecurityPolicy } from "../../../src/webview/PtaWebview";

const CSP_SOURCE = "https://test.vscode-cdn.net";
const NONCE = "abc123";

/** 从 CSP 字符串里取出某条指令 */
function directive(name: string): string {
    const csp = buildContentSecurityPolicy(CSP_SOURCE, NONCE);
    const found = csp.split("; ").find((part) => part.startsWith(`${name} `));
    return found ?? "";
}

describe("PtaWebview - Content-Security-Policy", () => {
    it("应以 default-src 'none' 兜底", () => {
        assert.strictEqual(buildContentSecurityPolicy(CSP_SOURCE, NONCE).startsWith("default-src 'none'"), true);
    });

    it("应放行 KaTeX 字体所在 origin", () => {
        // katex.min.css 用相对路径引用 60 个字体文件，没有 data: URI；
        // 缺了 font-src 公式字形会全部丢失
        assert.strictEqual(directive("font-src"), `font-src ${CSP_SOURCE}`);
    });

    it("应放行内联样式", () => {
        // KaTeX 的 renderToString 输出大量内联 style 属性，无法附加 nonce
        assert.strictEqual(directive("style-src"), `style-src ${CSP_SOURCE} 'unsafe-inline'`);
    });

    it("脚本应仅放行带 nonce 的资源", () => {
        assert.strictEqual(directive("script-src"), `script-src 'nonce-${NONCE}'`);
        assert.ok(
            !buildContentSecurityPolicy(CSP_SOURCE, NONCE).includes("script-src 'unsafe-inline'"),
            "不应放开内联脚本"
        );
    });

    it("应放行题目图片域名与二维码的 data: URI", () => {
        // 正文里以 http 开头的绝对外链会被 processLink 原样透传，故放行整个 https:
        assert.strictEqual(directive("img-src"), `img-src ${CSP_SOURCE} https: data:`);
    });

    it("nonce 变化时应产出不同的策略", () => {
        assert.notStrictEqual(
            buildContentSecurityPolicy(CSP_SOURCE, "nonce-a"),
            buildContentSecurityPolicy(CSP_SOURCE, "nonce-b")
        );
    });
});
