import * as vscode from "vscode";
import { Disposable } from "vscode";

export abstract class PtaWebview<T> implements Disposable {

    private currentPanel: vscode.WebviewPanel | undefined = undefined;
    private listeners: Disposable[] = [];
    private callback?: (data?: any) => void;

    protected data: any;
    protected abstract getStyle(): string;
    protected abstract getContent(): string;
    protected abstract loadViewData(view: T): Promise<void>;

    protected constructor(private view: T) {
    }

    public async show(focused: boolean = true): Promise<void> {
        await this.loadViewData(this.view);
        if (this.currentPanel) {
            this.currentPanel.title = `PTA: ${this.data.title}`;
            this.currentPanel.webview.html = await this.getWebviewContent();
            focused && this.currentPanel.reveal(vscode.ViewColumn.One);
            return;
        }
        this.currentPanel = vscode.window.createWebviewPanel(
            'PTA',
            `PTA: ${this.data.title}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );
        this.currentPanel.webview.html = await this.getWebviewContent();
        this.currentPanel.onDidDispose(this.onDidDisposeWebview, this, this.listeners);
        this.currentPanel.webview.onDidReceiveMessage(this.onDidReceiveMessage, this, this.listeners);
    }

    private async getWebviewContent() {
        return `
            <!doctype html>
            <html>
                <head>
                    <meta charset='utf-8'>
                    ${this.getStyle()}
                </head>
                <body>
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

    protected async onDidReceiveMessage(_msg: any): Promise<void> { }
}