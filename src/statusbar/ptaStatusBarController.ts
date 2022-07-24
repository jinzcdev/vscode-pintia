
import { ConfigurationChangeEvent, Disposable, workspace } from "vscode";
import { IUserSession } from "../entity/userLoginSession";
import { ptaConfig } from "../ptaConfig";
import { PtaStatusBarItem } from "./PtaStatusBarItem";

class PtaStatusBarController implements Disposable {
    private statusBar: PtaStatusBarItem;
    private configurationChangeListener: Disposable;

    constructor() {
        this.statusBar = new PtaStatusBarItem();
        this.setStatusBarVisibility();

        this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("pintia.enableStatusBar")) {
                this.setStatusBarVisibility();
            }
        }, this);
    }

    public updateStatusBar(userSession: IUserSession | undefined): void {
        this.statusBar.updateStatusBar(userSession);
    }

    public dispose(): void {
        this.statusBar.dispose();
        this.configurationChangeListener.dispose();
    }

    private setStatusBarVisibility(): void {
        if (this.isStatusBarEnabled()) {
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }
    }

    private isStatusBarEnabled(): boolean {
        return ptaConfig.getEnableStatusBar();
    }
}

export const ptaStatusBarController: PtaStatusBarController = new PtaStatusBarController();
