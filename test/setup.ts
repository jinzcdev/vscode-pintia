/**
 * Mocha 全局 setup：在加载业务模块前注入 vscode 等依赖的 mock。
 */
import * as Module from "module";
import * as sinon from "sinon";

type ModuleWithLoad = typeof Module & { _load: (request: string, parent: NodeModule, isMain: boolean) => unknown };
const moduleWithLoad = Module as unknown as ModuleWithLoad;
const originalLoad = moduleWithLoad._load;

moduleWithLoad._load = function (request: string, parent: NodeModule, isMain: boolean): unknown {
    if (request === "vscode") {
        return {
            l10n: { t: (msg: string) => msg },
            window: {
                showErrorMessage: sinon.stub().resolves(undefined),
                showInformationMessage: sinon.stub().resolves(undefined),
                showWarningMessage: sinon.stub().resolves(undefined),
                createOutputChannel: sinon.stub().returns({
                    appendLine: sinon.stub(),
                    append: sinon.stub(),
                    info: sinon.stub(),
                    warn: sinon.stub(),
                    error: sinon.stub(),
                    show: sinon.stub(),
                    dispose: sinon.stub(),
                }),
            },
            ProgressLocation: { Notification: 15 },
            TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
            ThemeIcon: class ThemeIcon {
                constructor(public readonly id: string) {}
            },
            EventEmitter: class EventEmitter {
                public event = (): void => {};
                public fire(): void {}
                public dispose(): void {}
            },
            workspace: {
                onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
            },
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
