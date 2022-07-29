# Pintia

> 在 VS Code 中练习Pintia公共题集

<p align="center">
  <img style="width: 50%; max-width: 60%;" src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/resources/pintia_logo.png" alt="">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=jinzcdev.vscode-pintia">
    <img src="https://img.shields.io/visual-studio-marketplace/d/jinzcdev.vscode-pintia?style=flat-square" alt="">
  </a>
  <a href="https://github.com/jinzcdev/vscode-pintia/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/jinzcdev/vscode-pintia?style=flat-square" alt="">
  </a>
</p>

- [English Document](https://github.com/jinzcdev/vscode-pintia/blob/main/README.md) | 中文文档

:exclamation: 如果您在中国, 可访问 [Gitee](https://gitee.com/jinzcdev/vscode-pintia). :exclamation:

## 0. 运行条件

- [VS Code 1.66.0+](https://code.visualstudio.com/)



## 1. 功能

### 1.1 登录/登出

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/signin.png" alt="Sign in" />
</p>


- 只需在 `Pintia Explorer` 中点击 `Sign in to Pintia` ，即可登录PTA。(目前，只支持**微信二维码**登录）。

- 你也可以使用以下命令来登录/退出。
  - **Pintia: Sign in**
  - **Pintia: Sign out**

---

### 1.2 预览一个问题

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/preview.png" alt="预览问题" />
</p>


- 点击问题，即可查看问题描述

  > :star: **注意：**
  >
  > - 您可以通过修改配置项 `pintia.workspaceFolder` 来指定存储题目文件的工作区路径。默认值为**$HOME/.pintia/codes**
  >
  > - 您可以通过 `Pintia: Change Default Language` 命令来改变默认语言，使用`Ctrl+P` (in Windows) 或 `Command+P` (in Mac)打开命令面板


---

### 1.3 编辑器快捷键

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/shortcuts.png" alt="编辑器快捷键" />
</p>


- 该插件支持2个编辑器快捷键

  - `Submit`：向Pintia提交你的答案
  - `Test`：用**自定义的测试样例**或**默认样例**测试你的答案

---

### 1.4 自定义测试样例

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/snippets.png" alt="自定义测试样例" />
</p>


- 您可以把您的代码放在`@pintia code=start`和`@pintia code=end`之间（在编辑区中输入`ptacode`来快速添加）
- 另外，您可以把您的**自定义测试样例**放在`@pintia test=start`和`@pintia test=end`之间（输入`ptatest`可以快速添加），并点击`Test custom sample` 以快速测试您的代码。

> :star: **Note:** 在点击`submit`或`test`提交你的代码时，只有在包裹在`@pintia code=start`和`@pintia code=end`之间的代码会被提交给 Pintia 判题器。

---

## 2. 使用

您能通过

## 2. 插件配置项

| 设置名称                  | 描述                                                         | 默认值           |
| ------------------------- | ------------------------------------------------------------ | ---------------- |
| `pintia.showLocked`       | 指定是否显示锁定的问题（一些题目集需要验证用户的**读者码**后方可提交） | `true`           |
| `pintia.defaultLanguage`  | 指定用于解题的默认语言。支持的语言有`C (gcc)`,`C++ (g++)`,`C (clang)`,`C++ (clang++)`,`Java (javac)`,`Python (python2)`,`Python (python3)`，`Ruby (ruby)`。 `Bash (bash)`,`Plaintext (cat)`,`CommonLisp (sbcl)`,`Pascal (fpc)`,`Go (go)`,`Haskell (ghc)`,`Lua (lua)`,`Lua (luajit)`,`C# (mcs)`。 `JavaScript (node)`,`OCaml (ocamlc)`,`PHP (php)`,`Perl (perl)`,`AWK (awk)`,`D (dmd)`,`Racket (racket)`,`Vala (valac)`,`Visual Basic (vbnc)`。 `Kotlin (kotlinc)`,`Swift (swiftc)`,`Objective-C (gcc)`,`Fortran95 (gfortran)`,`Octave (octave-cli)`,`R (R)`, `ASM (nasm. sh)`,`Rust (rustc)`,`Scala (scalac)`,`Python (pypy3)`,`SQL (SQL)` | `C++ (g++)` |
| `pintia.workspaceFolder`  | 指定工作区文件夹的路径，以存储代码文件                   | `""`             |
| `pintia.enableStatusBar`  | 指定是否显示Pintia状态栏                                   | `true`           |
| `pintia.editor.shortcuts` | 指定编辑器中的自定义快捷方式。目前仅支持`submit`, `test` | `["提交"，"测试"]` |
| `pintia.paging.pageSize`  | 当问题集过大时，是否对问题列表进行分页。当pageSize为0表示不分页 | `100`            |
| `pintia.autoCheckIn`      | 指定当Pintia插件被激活时，是否自动签到Pintia的教育商店 | `false`          |

## 3. 需要帮助？

在遇到任何问题时，您可以先查看[故障排除](https://github.com/jinzcdev/vscode-pintia/wiki/Troubleshooting)和[常见问题](https://github.com/jinzcdev/vscode-pintia/wiki/FAQ)。

如果您的问题仍然无法解决，可随时[创建一个新的Issue](https://github.com/jinzcdev/vscode-pintia/issues/new/choose)。

## 4. 更新日志

请参考 [CHANGELOG](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md) | [中文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/CHANGELOG_zh-CN.md)

## 5. 鸣谢

- Pintia Extension 的功能设计参考了[LeetCode](https://marketplace.visualstudio.com/items?itemName=LeetCode.vscode-leetcode)。