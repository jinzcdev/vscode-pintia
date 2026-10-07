# AGENTS.md

本文件为在此仓库中工作的 AI 编码助手（Claude Code、Codex 等）提供指引。

## 项目简介

`vscode-pintia` 是一个用于在 [拼题A / Pintia (PTA)](https://pintia.cn) 上刷题的 VS Code 扩展。拼题A 没有官方 SDK：扩展直接使用用户的 Cookie 调用其私有 JSON 接口，题目文件、收藏、历史记录与搜索索引都存放在 `~/.pintia/` 下。

运行时代码是 `tsc` 的直接产物——没有打包器（无 webpack）。`src/` 编译到 `out/`，`package.json` 的 `main` 指向该目录。

## 常用命令

```bash
npm run compile            # tsc -p ./ → out/
npm run watch              # tsc -w（VS Code 默认构建任务，F5 会先执行它）
npm run lint               # eslint（扁平配置：eslint.config.mjs）
npm run format             # prettier --write .
npm test                   # pretest 依次执行 compile + compile:test + lint，然后跑 mocha
npm run test:unit          # 仅跑 mocha（使用 out-test/ 中已有产物）

# 运行单个测试 —— 用 --grep 匹配 describe/it 标题（测试标题为中文）
npx mocha --grep "增量构建"
```

注意：测试运行的是 `out-test/` 中编译后的 JS，因此修改 `src/` 或 `test/` 后需先执行 `npm run compile:test`。给 mocha 传文件路径**不会**缩小运行范围——`.mocharc.json` 的 `spec` glob 始终会被合并进来，所以请用 `--grep`。

`test/setup.ts` 是 mocha 的 `require` 钩子：它在业务模块加载**之前**通过改写 `Module._load` 来打桩 `vscode` 模块。当被测代码用到新的 `vscode` API（`workspace`、`Uri`、`commands` 等）时，必须同步扩展该 mock，否则测试会在 import 阶段直接崩溃。测试里可用 `setConfigValue(section, value)` 覆盖配置项、`resetVscodeMock()` 清理 stub 与配置。

单元测试的文件层级**镜像 `src/`**，目录内文件名与源文件同名，同一模块需要多个文件时加切面后缀：

```
test/                                  # setup.ts 与 helpers/ 固定在根
├── setup.ts                           # mocha require 钩子 + 配置/stub 工具
├── tsconfig.json                      # 仅供 IDE 认领 test/，勿删（见下）
├── helpers/vscodeFakes.ts             # TextDocument/TextEditor 等伪造对象
└── unit/
    ├── ptaConfig.test.ts              # ← src/ptaConfig.ts
    ├── shared.mappings.test.ts        # ← src/shared.ts
    ├── utils/api.test.ts              # ← src/utils/api.ts
    ├── utils/api.problemSet403.test.ts
    ├── searchIndex/builder.test.ts    # ← src/searchIndex/builder.ts
    ├── searchIndex/builder.paging.test.ts
    └── ...
```

`.mocharc.json` 的 `spec` 是递归 glob（`out-test/test/unit/**/*.test.js`），`tsconfig.test.json` / eslint 的 include 同样是递归的，因此上述目录调整不需要改任何配置；只需注意 `setup`/`helpers` 的相对导入深度。

`test/tsconfig.json`（内容仅 `extends: "../tsconfig.test.json"`）**不可删除**：tsserver 只按文件名向上查找 `tsconfig.json`，并不认 `tsconfig.test.json`，而根 `tsconfig.json` 又 `exclude` 了 `test/`。没有它，`test/` 下的文件在 IDE 里不属于任何工程，会满屏报 `Cannot find name 'describe'... ts(2593)`（并诱导你装 `@types/jest`——那会与 `@types/mocha` 冲突并使 `compile:test` 失败）。命令行构建走 `tsc -p ./tsconfig.test.json`，不经过该文件。

离线构建搜索索引（仅开发者本地使用，不参与 VSIX 打包）：

```bash
PINTIA_COOKIE="..." npm run build:search-index -- --output ./resources/search_index.json --mode full
```

调试：`.vscode/launch.json` → "Run Extension"（extensionHost）。当前只有单元测试（`npm test`）；没有 VS Code 集成测试宿主——若要补，需按官方模板新增 `src/test/suite/index.ts` 与 `src/test/runTest.ts`，再在 launch.json 里加 `--extensionTestsPath` 配置。

## 架构

### `src/extension.ts` 中装配的单例

几乎所有模块都导出一个懒加载的单例（`ptaManager`、`ptaConfig`、`ptaExecutor`、`ptaChannel`、`explorerController`、`favoriteProblemsManager`、`historyManager`、`ptaStatusBarController`、`codeLensController`）。`activate()` 注册全部 `pintia.*` 命令，并把这些单例放进 `context.subscriptions`。项目没有 DI 容器——新增命令时，在 `extension.ts` 中注册，并在 `src/commands/*` 中实现。

`ptaManager` 是一个 `EventEmitter`：登录/登出/会话过期时触发 `statusChanged`，`extension.ts` 据此创建或销毁资源管理器视图，并刷新历史与收藏视图。业务代码通过 `ptaManager.getUserSession()?.cookie` 取 Cookie，而不是自己持有。

### 网络与缓存层

- `src/utils/api.ts`（`ptaApi`）集中了所有拼题A 接口；`src/utils/httpUtils.ts`（`httpGet`/`httpPost`，基于 node-fetch）是唯一发起 HTTP 请求的地方。HTTP 412 被视为成功（拼题A 用它表示"未登录"），`HttpRequestOptions.silentStatusCodes` 可为 403 等预期状态码抑制错误弹窗。
- 两级缓存：`ptaApi` 把原始接口响应以 JSON 写入 `~/.pintia/cache/`（dashboard、题集列表等）；`memory-cache`（`ptaCache`）存放进程内的短 TTL 条目（例如扁平化后的搜索索引缓存 5 分钟）。`pintia.clearCache` 通过 `ptaExecutor` 删除缓存目录；内存缓存按 key 失效。
- `src/utils/problemSetAccess.ts` 固化了"考试未开始 → 403"规则（修复 issue #22）；这类情况应静默处理，不要重试。

### 资源管理器树

`PtaTreeDataProvider` → `explorerNodeManager` → `PtaNode`，由 `src/shared.ts` 中的 `PtaNodeType` 驱动（`Dashboard` → `ProblemSet` → `ProblemSubSet` → `ProblemPage` → `Problem`）。`IPtaNode.value.summaries` 决定题集是展开为题型节点还是直接展开为题目/分页节点（受 `pintia.paging.pageSize` 影响）。summaries 为懒加载；空 `{}` 结果会被缓存，避免每次展开都重试 403。

### 题目文件与编辑器集成

生成的源文件中嵌入了机器可读的文件头与围栏块，由 `src/utils/editorUtils.ts` 解析：

```
@pintia psid=<id> pid=<id> compiler=<NAME>
@pintia code=start ... @pintia code=end      # 只有这段会被提交
@pintia test=start ... @pintia test=end      # 自定义测试样例
@pintia note=start ... @pintia note=end      # 笔记，随代码一起提交
```

`updatePtaValidCodeContext()` 设置 `pintia.validCodeFile` 上下文键，用于控制 `cmd/ctrl+shift+j|k` 快捷键是否生效；`CustomCodeLensProvider` 渲染 Submit/Test/Preview 三个 CodeLens。文件命名与存放位置（格式占位符、中文转拼音、按题集建目录）在 `src/commands/show.ts`。

### Webview

`PtaWebview<T>`（`src/webview/PtaWebview.ts`）是基类：每个 provider 一个面板，子类各自提供 `createOrUpdate(view)` 单例，流程为 `loadViewData` → `getStyle`/`getContent` → HTML 字符串。子类包括 `PtaPreviewProvider`（题目描述）、`PtaSubmissionProvider`、`PtaTestProvider`、`PtaLoginProvider`；对应的视图模型位于 `src/webview/views/`。Markdown 渲染走 `src/webview/markdownEngine.ts`（markdown-it + KaTeX + highlight.js，`$$...$$` 会被转成 KaTeX），`media/main.js` 通过 postMessage 提供复制按钮行为。

### 搜索索引（`src/searchIndex/`）

刻意拆分，使同一个 builder 能在两种宿主中运行：

- `store.ts` —— v2 JSON 文件格式（`version`、`cursors`、`problemSets`）以及 v1→v2 升级。
- `builder.ts` —— 基于游标的增量同步。对每个题集/题型，比较 `summaries[type].total` 与已存的 `syncedCount`，只拉取缺失的页；当接口总量下降时重置该题型。**本应有数据却返回 `[]` 的页会导致中止且不推进游标**（对应未参加考试的 404 场景）。
- `types.ts` —— `ISearchIndexApi` 是接缝：在 `src/commands/cache.ts` 中基于 `ptaApi` 实现，在 `scripts/build-search-index.ts` 中由独立的 fetch 客户端实现。
- `commands/cache.ts`（`ensureSearchIndexV2`）决定 v2 文件的初始内容：优先从旧版 v1 迁移，否则复制扩展内置种子。

索引文件，以及改动这块代码时必须遵守的规则：

| 路径                             | 作用                                                                  |
| -------------------------------- | --------------------------------------------------------------------- |
| `~/.pintia/search_index.v2.json` | v2 唯一读写的文件                                                     |
| `~/.pintia/search_index.json`    | 旧版 v1；**仅作迁移源，永不写入或删除**，它是用户回退旧版插件时的保底 |
| `resources/search_index.json`    | 随 VSIX 打包的 v2 种子                                                |

请求受 `SEARCH_INDEX_REQUEST_DELAY_MS`（1 秒/页）限速，因为拼题A 限流很激进；`scripts/build-search-index.ts` 另外为 429/503 增加了指数退避。

### 鉴权与纯本地状态

`src/auth/` 下有 `IUserAuthProvider` + `UserAuthProviderFactory`（微信扫码、Cookie、账号）。会话持久化在 `~/.pintia/user.json`，并在插件激活时重新校验。收藏（`favorites.json`）与预览历史（`view_history.json`）是纯本地数据——刻意不与拼题A 同步。

## 约定

- Prettier：4 空格缩进、120 列、双引号、分号。`husky` + `lint-staged` 会对暂存文件执行 `prettier --write`；做大范围改动前先跑 `npm run format`。
- 提交信息遵循带 scope 的 Conventional Commits：`feat(search-index):`、`fix(api):`、`chore(docs):`。版本号提交则直接使用版本号（如 `0.9.2`）。
- 所有面向用户的字符串都必须可本地化：运行时字符串用 `vscode.l10n.t(...)` / `@vscode/l10n`，条目写入 `l10n/bundle.l10n.zh-cn.json`；`package.json` 的贡献点使用 `%key%` 占位符，需同时定义在 `package.nls.json` 与 `package.nls.zh-cn.json`。新增条目时，你改动到的每个语言文件都要补齐。
- `.vscodeignore` 会把源码与开发侧文件排除在 VSIX 之外：`src/`、`test/`、`scripts/`、`out/scripts-build/`、`out-test/`、`resources/pta_template/`、`.husky/`、以及 `tsconfig*.json`、`eslint.config.*`、`.mocharc.json`、`.prettier*` 等开发配置；`out/`（运行时代码）与 `resources/search_index.json` 则是**有意**打包进去的。改动测试产物目录（如 `tsconfig.test.json` 的 `outDir`）时必须同步更新这里，否则测试产物会被打进发布物。验证方式：`npx @vscode/vsce ls`，对比改动前后的文件清单。注意名称类模式要写 `**/` 前缀——vsce 对 `node_modules` 下的匹配按 minimatch 语义处理，裸模式匹配不到嵌套路径。
- `src/shared.ts` 中的编译器表（`ptaCompiler`、`langCompilerMapping`）镜像自拼题A 网页端的常量——把它当数据看待，并保持两个方向的映射同步。
- Git 提交代码时，请确保 `src/` 与 `test/` 的 TypeScript 代码都能通过 `npm run compile` / `npm run test:unit` 构建与测试。并且要求提交时的 commit message 使用中文，以便于后续生成中文 Changelog。
