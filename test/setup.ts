/**
 * Mocha 全局 setup：在加载业务模块前注入 vscode 等依赖的 mock。
 *
 * 业务代码用到新的 vscode API（`workspace`、`Uri`、`commands` 等）时，必须同步扩展该 mock，
 * 否则测试会在 import 阶段直接崩溃。测试中可通过：
 *   - `setConfigValue(section, value)` —— 覆盖某个配置项（模拟用户设置）
 *   - `resetVscodeMock()` —— 清空配置与 stub 状态，避免用例互相污染
 * 来控制 mock 行为。
 */
import * as Module from "module";
import * as sinon from "sinon";

type ModuleWithLoad = typeof Module & { _load: (request: string, parent: NodeModule, isMain: boolean) => unknown };
const moduleWithLoad = Module as unknown as ModuleWithLoad;
const originalLoad = moduleWithLoad._load;

/** vscode.workspace.getConfiguration 背后的存储：命中的 key 覆盖默认值 */
const configurationValues = new Map<string, unknown>();

/** 覆盖单个配置项，等价于用户或工作区设置 */
export function setConfigValue(section: string, value: unknown): void {
    configurationValues.set(section, value);
}

/** 清空全部配置覆盖，恢复各 getter 的默认值 */
export function resetConfigValues(): void {
    configurationValues.clear();
}

function createOutputChannel(): Record<string, sinon.SinonStub> {
    return {
        appendLine: sinon.stub(),
        append: sinon.stub(),
        info: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
        show: sinon.stub(),
        dispose: sinon.stub(),
    };
}

function createWebviewPanel() {
    return {
        title: "",
        webview: {
            html: "",
            onDidReceiveMessage: sinon.stub(),
            asWebviewUri: (uri: unknown) => uri,
        },
        onDidDispose: sinon.stub(),
        reveal: sinon.stub(),
        dispose: sinon.stub(),
    };
}

function createStatusBarItem() {
    return {
        text: "",
        tooltip: "",
        command: "",
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub(),
    };
}

function createWindowMock() {
    return {
        showErrorMessage: sinon.stub().resolves(undefined),
        showInformationMessage: sinon.stub().resolves(undefined),
        showWarningMessage: sinon.stub().resolves(undefined),
        showQuickPick: sinon.stub().resolves(undefined),
        showInputBox: sinon.stub().resolves(undefined),
        showOpenDialog: sinon.stub().resolves(undefined),
        showTextDocument: sinon.stub().resolves(undefined),
        createOutputChannel: sinon.stub().callsFake(createOutputChannel),
        createStatusBarItem: sinon.stub().callsFake(createStatusBarItem),
        createWebviewPanel: sinon.stub().callsFake(createWebviewPanel),
        createTreeView: sinon.stub().returns({ dispose: sinon.stub() }),
        onDidChangeActiveTextEditor: sinon.stub().returns({ dispose: sinon.stub() }),
        onDidChangeActiveColorTheme: sinon.stub().returns({ dispose: sinon.stub() }),
        // 默认真正执行任务，便于测试 withProgress 包裹的业务逻辑
        withProgress: sinon
            .stub()
            .callsFake(async (_options: unknown, task: (progress: unknown, token: unknown) => unknown) =>
                task(
                    { report: sinon.stub() },
                    { isCancellationRequested: false, onCancellationRequested: sinon.stub() }
                )
            ),
        /** 测试可直接赋值以模拟当前打开的编辑器 */
        activeTextEditor: undefined as unknown,
        /** 测试可直接赋值以模拟当前颜色主题 */
        activeColorTheme: { kind: 2 },
    };
}

function createWorkspaceMock() {
    return {
        onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
        onDidChangeTextDocument: sinon.stub().returns({ dispose: sinon.stub() }),
        getConfiguration: sinon.stub().callsFake(() => ({
            get: (section: string, defaultValue?: unknown): unknown =>
                configurationValues.has(section) ? configurationValues.get(section) : defaultValue,
            update: async (section: string, value: unknown): Promise<void> => {
                configurationValues.set(section, value);
            },
            has: (section: string): boolean => configurationValues.has(section),
            inspect: (): undefined => undefined,
        })),
        updateWorkspaceFolders: sinon.stub().returns(true),
        getWorkspaceFolder: sinon.stub().returns(undefined),
        openTextDocument: sinon.stub().resolves(undefined),
        save: sinon.stub().resolves(true),
        /** 测试可直接赋值以模拟工作区 */
        workspaceFolders: undefined as unknown,
        textDocuments: [] as unknown[],
    };
}

function createCommandsMock() {
    return { executeCommand: sinon.stub().resolves(undefined) };
}

const windowMock = createWindowMock();
const workspaceMock = createWorkspaceMock();
const commandsMock = createCommandsMock();
const languagesMock = { registerCodeLensProvider: sinon.stub().returns({ dispose: sinon.stub() }) };

class UriMock {
    private constructor(public readonly fsPath: string) {}

    public static file(fsPath: string): UriMock {
        return new UriMock(fsPath);
    }

    public static parse(value: string): UriMock {
        return new UriMock(value);
    }

    public static joinPath(base: UriMock, ...parts: string[]): UriMock {
        return new UriMock([base.fsPath, ...parts].join("/"));
    }

    public get path(): string {
        return this.fsPath;
    }

    public get scheme(): string {
        return "file";
    }

    public toString(): string {
        return `file://${this.fsPath}`;
    }
}

class PositionMock {
    constructor(
        public readonly line: number,
        public readonly character: number
    ) {}
}

class RangeMock {
    constructor(
        public readonly start: PositionMock,
        public readonly end: PositionMock
    ) {}
}

class CodeLensMock {
    constructor(
        public readonly range: unknown,
        public command?: unknown
    ) {}
}

class SnippetStringMock {
    constructor(public readonly value: string) {}
}

class ThemeIconMock {
    constructor(public readonly id: string) {}
}

class EventEmitterMock {
    public event = (): void => {};
    public fire(): void {}
    public dispose(): void {}
}

const vscodeMock = {
    l10n: {
        // 支持 {0} 占位符，便于断言带参数的提示文案
        t: (message: string, ...args: unknown[]): string =>
            message.replace(/\{(\d+)\}/g, (placeholder: string, index: string) =>
                args[Number(index)] === undefined ? placeholder : String(args[Number(index)])
            ),
    },
    Uri: UriMock,
    Position: PositionMock,
    Range: RangeMock,
    CodeLens: CodeLensMock,
    SnippetString: SnippetStringMock,
    ThemeIcon: ThemeIconMock,
    EventEmitter: EventEmitterMock,
    ProgressLocation: { Notification: 15 },
    ViewColumn: { One: 1, Two: 2, Three: 3 },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    window: windowMock,
    workspace: workspaceMock,
    commands: commandsMock,
    languages: languagesMock,
};

/** 重置 mock：清空配置覆盖，并为所有 stub 重新安装默认行为与调用记录 */
export function resetVscodeMock(): void {
    resetConfigValues();
    // 就地替换属性，保持 `vscode.window` 等对象引用不变（业务模块持有的是同一个对象）
    Object.assign(windowMock, createWindowMock());
    Object.assign(workspaceMock, createWorkspaceMock());
    Object.assign(commandsMock, createCommandsMock());
    languagesMock.registerCodeLensProvider.reset();
    languagesMock.registerCodeLensProvider.returns({ dispose: sinon.stub() });
}

moduleWithLoad._load = function (request: string, parent: NodeModule, isMain: boolean): unknown {
    if (request === "vscode") {
        return vscodeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
};
