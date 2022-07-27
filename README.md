# Pintia

> Solve PTA problems in VS Code

<p align="center">
  <img style="width: 55%;" src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/resources/pintia_logo.png" alt="">
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

## Requirements

- [VS Code 1.66.0+](https://code.visualstudio.com/)

## Quick Start

![demo](https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/gifs/demo.gif)

## Features

### Sign In/Out

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/signin.png" alt="Sign in" />
</p>


- Simply click `Sign in to Pintia` in the `Pintia Explorer` will let you **sign in** with your Pintia account. (Currently, only **WeChat QR** codes are supported for signin)

- You can also use the following command to sign in/out:
  - **Pintia: Sign in**
  - **Pintia: Sign out**

---

### Preview a Problem

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/preview.png" alt="Preview Problem" />
</p>


- Directly click on the problem to see the problem description.

  > Note：You can specify the path of the workspace folder to store the problem files by updating the setting `pintia.workspaceFolder`. The default value is：**$HOME/.pintia/codes**.

  > You can change the default language by triggering the command: `Pintia: Change Default Language`.

---

### Editor Shortcuts

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/imgs/shortcuts.png" alt="Editor Shortcuts" />
</p>


- The extension supports 2 editor shortcuts (aka Code Lens):

  - `Submit`: Submit your answer to Pintia.
  - `Test`: Test your answer with customized test cases or default ones.

---

### Custom Test Samples

<p align="center">
  <img src="https://raw.githubusercontent.com/jinzcdev/vscode-pintia/main/docs/gifs/codelens.gif" alt="Custom Test Samples" />
</p>


- You can put your codes between `@pintia code=start` and `@pintia code=end` (enter `ptacode` to quickly add them).
- Also, you can put your custom test samples between `@pintia test=start` and `@pintia test=end` (enter `ptatest` to quickly add them).

---

## Settings

| Setting Name              | Description                                                  | Default Value      |
| ------------------------- | ------------------------------------------------------------ | ------------------ |
| `pintia.showLocked`       | Specify to show the locked problems or not. Some problem sets could be submitted when entering the reader's code. | `true`             |
| `pintia.defaultLanguage`  | Specify the default language used to solve the problem. Supported languages are: `C (gcc)`,`C++ (g++)`,`C (clang)`,`C++ (clang++)`,`Java (javac)`,`Python (python2)`,`Python (python3)`,`Ruby (ruby)`,`Bash (bash)`,`Plaintext (cat)`,`CommonLisp  (sbcl)`,`Pascal (fpc)`,`Go (go)`,`Haskell (ghc)`,`Lua (lua)`,`Lua (luajit)`,`C# (mcs)`,`JavaScript (node)`,`OCaml (ocamlc)`,`PHP (php)`,`Perl (perl)`,`AWK (awk)`,`D (dmd)`,`Racket (racket)`,`Vala (valac)`,`Visual Basic (vbnc)`,`Kotlin (kotlinc)`,`Swift (swiftc)`,`Objective-C (gcc)`,`Fortran95 (gfortran)`,`Octave (octave-cli)`,`R (R)`,`ASM (nasm.sh)`,`Rust (rustc)`,`Scala (scalac)`,`Python (pypy3)`,`SQL (SQL)` | `C++ (g++)`              |
| `pintia.workspaceFolder`  | Specify the path of the workspace folder to store the problem files. | `""`               |
| `pintia.enableStatusBar`  | Specify whether the Pintia status bar will be shown or not.  | `true`             |
| `pintia.editor.shortcuts` | Specify the customized shortcuts in editors. Supported values are: `submit`, `test`. | `["submit, test"]` |
| `pintia.paging.pageSize` | Whether to page the problem list when the problem set is too large. It is not paged when pageSize is 0. | `100` |
| `pintia.autoCheckIn` | Specify whether to check in Pintia's education supermarket or not when the Pintia Extension is activated. | `false` |

## Want Help?

When you meet any problem, you can check out the [Troubleshooting](https://github.com/jinzcdev/vscode-pintia/wiki/Troubleshooting) and [FAQ](https://github.com/jinzcdev/vscode-pintia/wiki/FAQ) first.

If your problem still cannot be addressed, feel free to [file an issue](https://github.com/jinzcdev/vscode-pintia/issues/new/choose).

## Release Notes

Refer to [CHANGELOG](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md)

## Acknowledgement

- The design of the `Pintia Extension` references the design of the [LeetCode](https://marketplace.visualstudio.com/items?itemName=LeetCode.vscode-leetcode) in many of its features.