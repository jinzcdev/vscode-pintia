import * as vscode from "vscode";

class PtaChannel implements vscode.Disposable {
    private readonly channel: vscode.LogOutputChannel = vscode.window.createOutputChannel("PTA (Pintia)", { log: true });

    public appendLine(message: string): void {
        this.channel.appendLine(message);
    }

    public append(message: string): void {
        this.channel.append(message);
    }

    public info(message: string, ...args: any[]): void {
        this.channel.info(message, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        this.channel.warn(message, ...args);
    }

    public error(message: string, ...args: any[]): void {
        this.channel.error(message, ...args);
    }

    public show(): void {
        this.channel.show();
    }

    public dispose(): void {
        this.channel.dispose();
    }
}

export const ptaChannel: PtaChannel = new PtaChannel();
