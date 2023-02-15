# Pintia

> 在 VS Code 中练习 Pintia 公共题集

<p align="center">
  <img style="width: 50%; max-width: 60%;" src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/pintia_logo.png" alt="">
</p>


<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=jinzcdev.vscode-pintia">
    <img src="https://img.shields.io/visual-studio-marketplace/d/jinzcdev.vscode-pintia?style=flat-square" alt="">
  </a>
  <a href="https://github.com/jinzcdev/vscode-pintia/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/jinzcdev/vscode-pintia?style=flat-square" alt="">
  </a>
</p>

- [English Document](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/README_en-US.md) | 中文文档

‼️ 如果您在中国, 可访问 [Gitee](https://gitee.com/jinzcdev/vscode-pintia). ‼️

⬇️ 安装 Pintia:  [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jinzcdev.vscode-pintia), [VS Code](https://code.visualstudio.com/) or [Install from VSIX](https://github.com/jinzcdev/vscode-pintia/releases/latest)

## 0. 运行条件

- [VS Code 1.66.0+](https://code.visualstudio.com/)


## 1. 功能

### 1.1 登录/登出

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/signin.png" alt="登录" />
</p>


- 只需在 `Pintia Explorer` 中点击 `Sign in to Pintia` ，即可登录PTA。(目前，只支持**微信二维码**登录）。

- 你也可以使用以下命令来登录/退出。
  - **Pintia: Sign In**
  - **Pintia: Sign Out**

---

### 1.2 预览题目

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/preview.jpg" alt="预览问题" />
</p>


- 点击问题，即可查看问题描述

  > :star: **注意：**
  > 
  > - 您可以通过修改配置项 `pintia.workspaceFolder` 来指定存储题目文件的工作区路径。默认值为 **\$HOME/.pintia/codes**
  >
  > - 您可以通过 `Pintia: Change Default Language` 命令来更换默认语言


---

### 1.3 编辑器快捷键

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/shortcuts.jpg" alt="编辑器快捷键" />
</p>


- 该插件支持2个编辑器快捷键

  - `Submit`：向 Pintia 提交你的答案
  - `Test`：用 **自定义的测试样例** 或 **默认样例** 测试你的答案
  - `Preview`: 在源文件中打开习题预览

---

### 1.4 自定义测试样例

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/snippets.jpg" alt="自定义测试样例" />
</p>


- 您可以把您的代码放在 `@pintia code=start` 和 `@pintia code=end` 之间（在编辑区中输入 `ptacode` 来快速添加）
- 另外，您可以把您的 **自定义测试样例** 放在 `@pintia test=start` 和 `@pintia test=end` 之间（输入 `ptatest` 可以快速添加），并点击 `Test custom sample` 以快速测试您的代码。

> :star: **Note:** 在点击 `submit` 或 `test` 提交你的代码时，只有在包裹在 `@pintia code=start` 和 `@pintia code=end` 之间的代码会被提交给 Pintia 判题器。

---

### 1.5 搜索题目

点击 Pintia 视图顶部的 `搜索` 图标，或者打开 命令面板，使用 `Pintia: Search Problem` 快捷命令。

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/search.png" alt="搜索题目" />
</p>

---

### 1.6 笔记功能

你可以在代码编辑区键入 `ptanote` 生成笔记块，在其中输入你的笔记，下次预览题目时，笔记会以 Markdown 的形式解析并预览。

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/note.png" alt="笔记" />
</p>

> :star: **Note:** 笔记是随着代码一起提交到 拼题A 的，并不存在本地。提交代码后，重新点击编辑器的 `Preview`，或者下次预览本题时，会显示你的笔记。

---

### 1.7 代码片段

你可以在代码编辑器中输入以下前缀来快速生成相应的代码块，如下所示。

| 前缀 | 说明 |
| --- | --- |
| ptacode | 把你的自定义测试样例放在 `@pintia code=start/end` 中，当你点击 `Submit` 按钮时，插件会自动识别它 |
| ptatest | 将你的自定义测试样例放在 `@pintia test=start/end` 中，当你点击 `Test` 按钮时，插件会自动识别它 |
| ptacpp_stdc++ | 获取头文件为 `bits/stdc++.h` 的 cpp 模板 |
| ptacpp_iostream | 获取带有 `iostream` 头文件的 cpp 模板 |
| ptaclang | 获取带有头文件 `stdio.h` 的 clang 模板 |
| ptajava_buffer | 获取带有 `BufferReader` 的 java 模板 |
| ptajava_scanner | 获取带有 `Scanner` 的 java 模板 |
| ptanote | 生成 `@pintia note=start/end` 笔记块 |

---

## 2. 插件使用

使用 `Ctrl+Shift+P` (in Windows) 或 `Command+Shift+P` (in Mac)打开命令面板并输入 `pintia` 可快速使用插件的相关命令。

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/commands.png" alt="命令面板" />
</p>

## 3. 插件配置项

| 设置名称                  | 描述                                                         | 默认值           |
| ------------------------- | ------------------------------------------------------------ | ---------------- |
| `pintia.showLocked`       | 指定是否显示锁定的问题（一些题目集需要验证用户的**读者码**后方可提交） | `true`           |
| `pintia.defaultLanguage`  | 指定用于解题的默认语言。支持的语言有`C (gcc)`, `C++ (g++)`, `C (clang)`, `C++ (clang++)`, `Java (javac)`, `Python (python2)`, `Python (python3)`, `Ruby (ruby)`, `Bash (bash)`, `Plaintext (cat)`, `CommonLisp (sbcl)`, `Pascal (fpc)`, `Go (go)`, `Haskell (ghc)`, `Lua (lua)`, `Lua (luajit)`, `C# (mcs)`, `JavaScript (node)`, `OCaml (ocamlc)`, `PHP (php)`, `Perl (perl)`, `AWK (awk)`, `D (dmd)`, `Racket (racket)`, `Vala (valac)`, `Visual Basic (vbnc)`, `Kotlin (kotlinc)`, `Swift (swiftc)`, `Objective-C (gcc)`, `Fortran95 (gfortran)`, `Octave (octave-cli)`, `R (R)`, `ASM (nasm. sh)`, `Rust (rustc)`, `Scala (scalac)`, `Python (pypy3)`, `SQL (SQL)` | `C++ (g++)` |
| `pintia.workspaceFolder`  | 指定工作区文件夹的路径，以存储代码文件                   | `""`             |
| `pintia.enableStatusBar`  | 指定是否显示 Pintia 状态栏                                   | `true`           |
| `pintia.editor.shortcuts` | 指定编辑器中的自定义快捷方式。目前仅支持 `Submit`, `Test`, `Preview` | `["Submit"，"Test", "Preview"]` |
| `pintia.paging.pageSize`  | 当问题集过大时，是否对问题列表进行分页。当pageSize为0表示不分页 | `100`            |
| `pintia.autoCheckIn`      | 指定当 Pintia 插件被激活时，是否自动签到 Pintia 的教育商店 | `false`          |
| `pintia.searchIndex.ignoreZOJ` | 指定搜索题目时，是否忽略 `ZOJ Problem Set` | `true`          |
| `pintia.searchIndex.autoRefresh` | 指定是否在插件被激活时，自动刷新题目搜索索引 | `false`          |
| `pintia.autoCreateProblemSetFolder` | 指定创建题目源文件时是否自动创建其习题集文件夹并将源代码文件放入相应的文件夹中 | `true`          |

## 4. 需要帮助？

在遇到任何问题时，您可以先查看[故障排除](https://github.com/jinzcdev/vscode-pintia/wiki/Troubleshooting)和[常见问题](https://github.com/jinzcdev/vscode-pintia/wiki/FAQ)。

如果问题仍然无法解决，可随时[创建一个新的Issue](https://github.com/jinzcdev/vscode-pintia/issues/new/choose)。

## 5. 更新日志

请参考 [CHANGELOG](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md) | [英文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/CHANGELOG_en-US.md)

## 6. 鸣谢

- Pintia Extension 的功能设计参考了 [LeetCode](https://marketplace.visualstudio.com/items?itemName=LeetCode.vscode-leetcode)。
