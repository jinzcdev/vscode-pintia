import * as vscode from "vscode";
import { Disposable, l10n } from "vscode";
import { ptaChannel } from "../ptaChannel";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

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
        } catch (error) {
            ptaChannel.error(error instanceof Error ? error.message : String(error));
            promptForOpenOutputChannel(l10n.t(`Failed to load the webview.`), DialogType.error);
        }
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

    protected async onDidReceiveMessage(_msg: IWebViewMessage): Promise<void> { }
}

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export interface IWebViewMessage {
    type: string; // 'command' or 'text'
    value: string; // the value of `type`
}