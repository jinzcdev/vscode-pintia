import { ConfigurationChangeEvent, Disposable, languages, workspace } from "vscode";
import { timerManager } from "../timer/timerManager";
import { customCodeLensProvider, CustomCodeLensProvider } from "./CustomCodeLensProvider";

class CodeLensController implements Disposable {
    private internalProvider: CustomCodeLensProvider;
    private registeredProvider: Disposable | undefined;
    private configurationChangeListener: Disposable;
    /** 计时状态变化时刷新「开始/暂停/继续计时」按钮的文案 */
    private readonly onTimerStateChanged = (): void => this.internalProvider.refresh();

    constructor() {
        this.internalProvider = customCodeLensProvider;

        this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("pintia.editor.shortcuts")) {
                this.internalProvider.refresh();
            }
        }, this);

        timerManager.on("stateChanged", this.onTimerStateChanged);
        this.registeredProvider = languages.registerCodeLensProvider({ scheme: "file" }, this.internalProvider);
    }

    public dispose(): void {
        timerManager.off("stateChanged", this.onTimerStateChanged);
        if (this.registeredProvider) {
            this.registeredProvider.dispose();
        }
        this.configurationChangeListener.dispose();
    }
}

export const codeLensController: CodeLensController = new CodeLensController();
