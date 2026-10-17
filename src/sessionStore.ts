import { IUserSession } from "./entity/userLoginSession";

/**
 * 当前登录会话的唯一存放处。
 *
 * 刻意做成不依赖任何业务模块的叶子模块。此前 `ptaManager` 要读 `ptaApi`
 * （校验会话、取用户信息），而 `ptaApi` 与 `httpUtils` 又要读 cookie，三者互相
 * import 形成循环——正确性只能靠「谁先被加载」的运气维持。把会话状态单独放在这里后，
 * 依赖方向变成 `ptaManager → sessionStore ← httpUtils/api` 的汇合，不再成环。
 *
 * **写入方只有 `ptaManager`**（登录 / 登出 / 启动时恢复会话），其余模块一律只读。
 */
let currentSession: IUserSession | undefined;

export function setSession(session: IUserSession | undefined): void {
    currentSession = session;
}

export function getSession(): IUserSession | undefined {
    return currentSession;
}
