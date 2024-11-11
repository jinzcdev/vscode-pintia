import * as vscode from "vscode";
import { Disposable } from "vscode";

export abstract class PtaWebview implements Disposable {

    protected currentPanel: vscode.WebviewPanel | undefined = undefined;
    protected data: { title: string, style: string, content: string } = { title: "", style: "", content: "" };
    private listeners: Disposable[] = [];
    private callback?: (data?: any) => void;

    protected abstract getStyle(data?: any): string;
    protected abstract getContent(data?: any): string;

    protected show(): void {
        if (this.currentPanel) {
            this.currentPanel.title = `PTA: ${this.data.title}`;
            this.currentPanel.webview.html = this.getWebviewContent();
            this.currentPanel.reveal(vscode.ViewColumn.One);
        } else {
            this.currentPanel = vscode.window.createWebviewPanel(
                'PTA',
                `PTA: ${this.data.title}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );
            this.currentPanel.webview.html = this.getWebviewContent();
            this.currentPanel.onDidDispose(this.onDidDisposeWebview, this, this.listeners);
            this.currentPanel.webview.onDidReceiveMessage(this.onDidReceiveMessage, this, this.listeners);

        }
    }

    // <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">
    protected getWebviewContent() {
        return `
            <!doctype html>
            <html>
                <head>
                    <meta charset='utf-8'>
                    ${this.data.style}
                </head>
                <body>
                    ${this.data.content}
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

    protected async onDidReceiveMessage(_msg: any): Promise<void> { }
}