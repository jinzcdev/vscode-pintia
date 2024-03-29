# Pintia

> Solve PTA problems in VS Code

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


- English Document | [中文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/README.md)

‼️ If you are in China, you can visit [Gitee](https://gitee.com/jinzcdev/vscode-pintia). ‼️

⬇️ Install Pintia from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jinzcdev.vscode-pintia) or [VS Code](https://code.visualstudio.com/).


## 0. Requirements

- [VS Code 1.66.0+](https://code.visualstudio.com/)


## 1. Features

### 1.1 Sign In/Out

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/signin.png" alt="Sign in" />
</p>


- Simply click `Sign in PTA` in the `Pintia Explorer` will let you **sign in** with your Pintia account. (Currently, only **WeChat QR** codes are supported for signin)

- You can also use the following command to sign in/out:
  - **Pintia: Sign in**
  - **Pintia: Sign out**

---

### 1.2 Preview a Problem

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/preview.jpg" alt="Preview Problem" />
</p>


- Directly click on the problem to see the problem description.

  > :star: **Note:** 
  > - You can specify the path of the workspace folder to store the problem files by updating the setting `pintia.workspaceFolder`. The default value is：**\$HOME/.pintia/codes**.
  > - You can change the default language by triggering the command: `Pintia: Change Default Language`.

---

### 1.3 Editor Shortcuts

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/shortcuts.jpg" alt="Editor Shortcuts" />
</p>


- The extension supports 2 editor shortcuts (aka Code Lens):

  - `Submit`: Submit your answer to Pintia.
  - `Test`: Test your answer with customized test cases or default ones.
  - `Preview`: Open the problem preview in source files.

---

### 1.4 Custom Test Samples

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/snippets.jpg" alt="Custom Test Samples" />
</p>


- You can put your codes between `@pintia code=start` and `@pintia code=end` (enter `ptacode` to quickly add them).
- Also, you can put your custom test samples between `@pintia test=start` and `@pintia test=end` (enter `ptatest` to quickly add them).
And then click `Test custom sample` to quickly test your code.
> :star: **Note:** Only the code wrapped between `@pintia code=start` and `@pintia code=end` will be submitted to Pintia judge when you try to submit your codes by clicking `submit` or `test`.

---

### 1.5 Search for Problems

Click the `Search` icon at the top of the `Pintia` view or open the `Command Palette` to use shortcut command `Pintia: Search Problem`.

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/search.png" alt="SearchProblem" />
</p>

---

### 1.6 Notebook

you can type `ptanote` in the code editor to generate a **note block**, where you can enter your notes, and the next time you preview the problem, the notes will be parsed and previewed in Markdown.

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/note.png" alt="Note" />
</p>

> :star: **Note:** Your notes are submitted to PTA along with the code, not stored locally. After submitting the code, re-click `Preview` in the editor, or the next time you preview problems, your notes will be displayed on the preview page of the problem.

---

### 1.7 Collect Problems

You can add the problem to the `My Favorites` list by clicking the button on the right side of the problem. This feature does not depend on the official service, so you can only store the collected topics locally. The synchronization of data will be considered later using other methods.

---

### 1.8 Snippets

You can enter the following prefixs in code editor to generate the corresponding code blocks quickly, as follows:

| Prefix | Description |
| --- | --- |
| ptacode | Put your custom test samples in `@pintia code=start/end` and the extension will automatically recognize it when you click the `Submit` button. |
| ptatest | Put your custom test samples in `@pintia test=start/end` and the extension will automatically recognize it when you click the `Test` button. |
| ptacpp_stdc++ | Get the template of cpp with header file of `bits/stdc++.h` |
| ptacpp_iostream | Get the template of cpp with header file of `iostream` |
| ptaclang | Get the template of clang with header file of `stdio.h` |
| ptajava_buffer | Get the template of java with `BufferReader` |
| ptajava_scanner | Get the template of java with `Scanner` |
| ptanote | Generate `@pintia note=start/end` block |

---

## 2. Usage

Use `Ctrl+Shift+P` (in Windows) or `Command+Shift+P` (in Mac) to open the command panel and enter `pintia` for quick access to the `Pintia Extension`'s related commands.

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/commands.png" alt="Command Palette" />
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
| `pintia.searchIndex.ignoreZOJ` | Specify whether to ignore the problem set *ZOJ Problem Set* in problem search index | `true` |
| `pintia.searchIndex.ignoreLockedProblemSets` | Specify whether to ignore locked problem sets in the problem search index | `true` |
| `pintia.searchIndex.autoRefresh` | Specify whether to automatically refresh problem search index when the Pintia Extension is activated | `false` |
| `pintia.autoCreateProblemSetFolder` | Specify whether to automatically create a problem set folder and place source code files in this directory when coding a problem | `true` |


## 4. Want Help?

When you meet any problem, you can check out the [Troubleshooting](https://github.com/jinzcdev/vscode-pintia/wiki/Troubleshooting) and [FAQ](https://github.com/jinzcdev/vscode-pintia/wiki/FAQ) first.

If your problem still cannot be addressed, feel free to [file an issue](https://github.com/jinzcdev/vscode-pintia/issues/new/choose).

## 5. Release Notes

Refer to [CHANGELOG](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md) | [英文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/CHANGELOG_en-US.md)

## 6. Acknowledgement

- The design of the `Pintia Extension` references the design of the [LeetCode](https://marketplace.visualstudio.com/items?itemName=LeetCode.vscode-leetcode) in many of its features.