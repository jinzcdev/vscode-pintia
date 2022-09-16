# Pintia

> Solve PTA problems in VS Code

<p align="center">
  <img style="width: 50%; max-width: 60%;" src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/pintia_logo.png" alt="">
</p>


<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=jinzcdev.vscode-pintia">
    <img src="https://img.shields.io/visual-studio-marketplace/d/jinzcdev.vscode-pintia?style=flat-square" alt="">
  </a>
  <a href="https://github.com/jinzcdev/vscode-pintia/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/jinzcdev/vscode-pintia?style=flat-square" alt="">
  </a>
</p>


- English Document | [中文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/README_zh-CN.md)

‼️ If you are in China, you can visit [Gitee](https://gitee.com/jinzcdev/vscode-pintia). ‼️

⬇️ Install Pintia from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jinzcdev.vscode-pintia) or [VS Code](https://code.visualstudio.com/).


## 0. Requirements

- [VS Code 1.66.0+](https://code.visualstudio.com/)


## 1. Features

### 1.1 Sign In/Out

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/signin.png" alt="Sign in" />
</p>


- Simply click `Sign in to Pintia` in the `Pintia Explorer` will let you **sign in** with your Pintia account. (Currently, only **WeChat QR** codes are supported for signin)

- You can also use the following command to sign in/out:
  - **Pintia: Sign in**
  - **Pintia: Sign out**

---

### 1.2 Preview a Problem

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/preview.png" alt="Preview Problem" />
</p>


- Directly click on the problem to see the problem description.

  > :star: **Note:** 
  > - You can specify the path of the workspace folder to store the problem files by updating the setting `pintia.workspaceFolder`. The default value is：**\$HOME/.pintia/codes**.
  > - You can change the default language by triggering the command: `Pintia: Change Default Language`.

---

### 1.3 Editor Shortcuts

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/shortcuts.png" alt="Editor Shortcuts" />
</p>


- The extension supports 2 editor shortcuts (aka Code Lens):

  - `Submit`: Submit your answer to Pintia.
  - `Test`: Test your answer with customized test cases or default ones.

---

### 1.4 Custom Test Samples

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/snippets.png" alt="Custom Test Samples" />
</p>


- You can put your codes between `@pintia code=start` and `@pintia code=end` (enter `ptacode` to quickly add them).
- Also, you can put your custom test samples between `@pintia test=start` and `@pintia test=end` (enter `ptatest` to quickly add them).
And then click `Test custom sample` to quickly test your code.
> :star: **Note:** Only the code wrapped between `@pintia code=start` and `@pintia code=end` will be submitted to Pintia judge when you try to submit your codes by clicking `submit` or `test`.

---

### 1.5 Snippets

You can enter the following prefixs in code editor to generate the corresponding code blocks quickly, as follows:

| Prefix | Description |
| --- | --- |
| ptacode | Put your custom test samples in `@pintia code=start/end` and the extension will automatically recognize it when you click the `Submit` button. |
| ptatest | Put your custom test samples in `@pintia test=start/end` and the extension will automatically recognize it when you click the `Test` button. |
| ptacpp_stdc++ | Get the template of cpp with header file of `bits/stdc++.h` |
| ptacpp_iostream | Get the template of cpp with header file of `iostream` |
| ptaclang | Get the template of clang with header file of `stdio.h` |

---

## 2. Usage

Use `Ctrl+Shift+P` (in Windows) or `Command+Shift+P` (in Mac) to open the command panel and enter `pintia` for quick access to the `Pintia Extension`'s related commands.

<p align="center">
  <img src="https://gitee.com/jinzcdev/vscode-pintia/raw/main/docs/imgs/commands.png" alt="Command Palette" />
</p>

## 3. Settings

| Setting Name              | Description                                                  | Default Value      |
| ------------------------- | ------------------------------------------------------------ | ------------------ |
| `pintia.showLocked`       | Specify to show the locked problem sets or not. (Some problem sets require verification of the user's reader code before they can be submitted) | `true`             |
| `pintia.defaultLanguage`  | Specify the default language used to solve the problem. Supported languages are: `C (gcc)`, `C++ (g++)`, `C (clang)`, `C++ (clang++)`, `Java (javac)`, `Python (python2)`, `Python (python3)`, `Ruby (ruby)`, `Bash (bash)`, `Plaintext (cat)`, `CommonLisp (sbcl)`, `Pascal (fpc)`, `Go (go)`, `Haskell (ghc)`, `Lua (lua)`, `Lua (luajit)`, `C# (mcs)`, `JavaScript (node)`, `OCaml (ocamlc)`, `PHP (php)`, `Perl (perl)`, `AWK (awk)`, `D (dmd)`, `Racket (racket)`, `Vala (valac)`, `Visual Basic (vbnc)`, `Kotlin (kotlinc)`, `Swift (swiftc)`, `Objective-C (gcc)`, `Fortran95 (gfortran)`, `Octave (octave-cli)`, `R (R)`, `ASM (nasm. sh)`, `Rust (rustc)`, `Scala (scalac)`, `Python (pypy3)`, `SQL (SQL)` | `C++ (g++)`              |
| `pintia.workspaceFolder`  | Specify the path of the workspace folder to store the problem files. | `""`               |
| `pintia.enableStatusBar`  | Specify whether the Pintia status bar will be shown or not.  | `true`             |
| `pintia.editor.shortcuts` | Specify the customized shortcuts in editors. Supported values are: `submit`, `test`. | `["submit", "test"]` |
| `pintia.paging.pageSize` | Whether to page the problem list when the problem set is too large. It is not paged when pageSize is 0. | `100` |
| `pintia.autoCheckIn` | Specify whether to check in Pintia's education supermarket or not when the Pintia Extension is activated. | `false` |

## 4. Want Help?

When you meet any problem, you can check out the [Troubleshooting](https://github.com/jinzcdev/vscode-pintia/wiki/Troubleshooting) and [FAQ](https://github.com/jinzcdev/vscode-pintia/wiki/FAQ) first.

If your problem still cannot be addressed, feel free to [file an issue](https://github.com/jinzcdev/vscode-pintia/issues/new/choose).

## 5. Release Notes

Refer to [CHANGELOG](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md) | [中文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/CHANGELOG_zh-CN.md)

## 6. Acknowledgement

- The design of the `Pintia Extension` references the design of the [LeetCode](https://marketplace.visualstudio.com/items?itemName=LeetCode.vscode-leetcode) in many of its features.