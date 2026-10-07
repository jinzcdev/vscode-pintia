import * as vscode from "vscode";

/**
 * 扩展上下文持有者。
 *
 * 刻意独立于 `extension.ts`：webview 各 provider 需要读取 `extensionUri`，
 * 若直接从 `extension.ts` 导入会形成
 * `webview provider → extension → provider` 的循环依赖，
 * 导致先加载 webview 层时 `PtaWebviewWithCodeStyle` 尚未定义而崩溃。
 */
let globalContext: vscode.ExtensionContext;

/** 由 `activate()` 在扩展激活时注入 */
export function setGlobalContext(context: vscode.ExtensionContext): void {
    globalContext = context;
}

/** 读取扩展上下文；仅在 `activate()` 之后可用 */
export function getGlobalContext(): vscode.ExtensionContext {
    return globalContext;
}
