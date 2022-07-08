// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { ConfigurationChangeEvent, Disposable, workspace, WorkspaceConfiguration } from "vscode";
import { IUserSession } from "../entity/userLoginSession";
import { UserStatus } from "../shared";
import { PtaStatusBarItem } from "./PtaStatusBarItem";

class PtaStatusBarController implements Disposable {
    private statusBar: PtaStatusBarItem;
    private configurationChangeListener: Disposable;

    constructor() {
        this.statusBar = new PtaStatusBarItem();
        this.setStatusBarVisibility();

        this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("pta.enableStatusBar")) {
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
        const configuration: WorkspaceConfiguration = workspace.getConfiguration();
        return configuration.get<boolean>("pta.enableStatusBar", true);
    }
}

export const ptaStatusBarController: PtaStatusBarController = new PtaStatusBarController();
