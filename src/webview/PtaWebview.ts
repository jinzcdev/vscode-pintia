import * as vscode from "vscode";
import { Disposable, l10n } from "vscode";
import { getGlobalContext } from "../globalContext";
import { ptaChannel } from "../ptaChannel";
import { escapeHtml } from "../utils/stringUtils";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

/**
 * 构造 webview 的 Content-Security-Policy。
 *
 * 每一条指令都对应一处真实资源，收紧任意一条都会破坏现有渲染：
 * - `font-src`：`katex.min.css` 用相对路径引用 60 个字体文件（无 data URI），
 *   缺了这条公式字形全部丢失
 * - `style-src 'unsafe-inline'`：KaTeX 的 `renderToString` 会输出大量内联 style 属性
 *   （无法附加 nonce），另外各 provider 还会注入内联 `<style>` 块
 * - `script-src`：只放行带 nonce 的 `media/main.js`。该脚本只用 DOM 属性赋值
 *   （`el.onclick = fn`），不生成内联事件属性、不 eval，因此 nonce 足够
 * - `img-src`：题目图片（正文里以 `http` 开头的绝对外链会被原样透传，故放行整个 `https:`）
 *   以及登录二维码的 `data:` URI
 *
 * 收益：题目正文虽然以 `html: true` 渲染（原样进入 DOM），但其中的 `<script>` 与
 * `onerror=` 之类都会被这里挡住。
 */
export function buildContentSecurityPolicy(cspSource: string, nonce: string): string {
    return [
        `default-src 'none'`,
        `img-src ${cspSource} https: data:`,
        `font-src ${cspSource}`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}'`,
    ].join("; ");
}

export abstract class PtaWebview<T> implements Disposable {
    private currentPanel: vscode.WebviewPanel | undefined = undefined;
    private listeners: Disposable[] = [];
    private callback?: (data?: any) => void;

    /**
     * 每次渲染共用的 nonce。
     *
     * 必须是同一个值：head 里的 CSP 与 body 里的 `<script>` 要对得上，
     * 否则脚本会被 CSP 拦掉。此前两处各自调 `getNonce()`，值互不相同。
     */
    protected readonly nonce: string = getNonce();

    protected data: any;
    protected abstract getStyle(): string;
    protected abstract getContent(): string;
    protected abstract loadViewData(view: T): Promise<void>;

    protected constructor(private view: T) {}

    public async show(focused: boolean = true): Promise<void> {
        try {
            await this.loadViewData(this.view);
            if (!focused && !this.currentPanel) {
                return;
            }
            if (this.currentPanel) {
                this.currentPanel.title = `PTA: ${this.data.title}`;
                this.currentPanel.webview.html = await this.getWebviewContent();
                focused && this.currentPanel.reveal(vscode.ViewColumn.One);
                return;
            }
            this.currentPanel = vscode.window.createWebviewPanel(
                "PTA",
                `PTA: ${this.data.title}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    // 必须覆盖整个扩展目录：KaTeX 字体在 node_modules/katex/dist、
                    // highlight.js 主题在 node_modules/highlight.js/styles，
                    // 只放行 media/ 会让这两者立刻失效
                    localResourceRoots: [getGlobalContext().extensionUri],
                }
            );
            this.currentPanel.webview.html = await this.getWebviewContent();
            this.currentPanel.onDidDispose(this.onDidDisposeWebview, this, this.listeners);
            this.currentPanel.webview.onDidReceiveMessage(this.onDidReceiveMessage, this, this.listeners);
        } catch (error) {
            ptaChannel.error(error instanceof Error ? error.message : String(error));
            promptForOpenOutputChannel(l10n.t("Failed to load the webview."), DialogType.error);
        }
    }

    private async getWebviewContent() {
        const cspSource = this.getWebview()?.cspSource ?? "";
        return `
            <!doctype html>
            <html>
                <head>
                    <meta charset='utf-8'>
                    <meta http-equiv="Content-Security-Policy" content="${buildContentSecurityPolicy(cspSource, this.nonce)}">
                    ${this.getStyle()}
                </head>
                <body data-copy-label="${escapeHtml(l10n.t("Copy"))}" data-copied-label="${escapeHtml(
                    l10n.t("Successfully copied to the clipboard!")
                )}">
                    ${this.getContent()}
                </body>
            </html>
        `;
    }

    public onDidDisposeCallBack(callback: ((data?: any) => void) | undefined) {
        this.callback = callback;
    }

    public dispose() {
        if (this.currentPanel) {
            this.currentPanel.dispose();
        }
    }

    protected onDidDisposeWebview(): void {
        this.currentPanel = undefined;
        for (const listener of this.listeners) {
            listener.dispose();
        }
        this.listeners = [];
        if (this.callback) {
            this.callback();
        }
    }

    protected getWebview(): vscode.Webview | undefined {
        return this.currentPanel?.webview;
    }

    protected updateView(view: T): void {
        this.view = view;
    }

    protected async onDidReceiveMessage(_msg: IWebViewMessage): Promise<void> {}
}

export function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export interface IWebViewMessage {
    type: string; // 'command' or 'text'
    value: string; // the value of `type`
    /** 命令参数（如题目预览需要的 psID/pID） */
    args?: unknown[];
}
