# Change Log

[中文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md)

---

## [0.3.0] - 2023/01/24

### Added

- Add the Walkthroughs to instruct how to use this extension. Type `Get Started: Open Walkthroughs...` in the Command Palette
- Add problem search and its corresponding command `Pintia: Search Problem`
- Automatically switch between English and Chinese according to the language of VS Code
- Add `Preview` shortcut command in the code editor to re-preview a problem
- Common templates for Java (BufferReader, Scanner)
- Add search engine and `Solution` link for quick search in problem preview

### Change

- Fix bug when submitting tests
- Change `Line Comment` to `Block Comment`, when adding custom test samples

---

## [0.2.1] - 2022/11/29

### Changed

- Fix the name error of 'Output' view (Pinta -> PTA (Pintia))
- Change the default language of the `README` to Chinese

## [0.2.0] - 2022/09/17

### Added

- Highlight the code of preview
- Add the command `Pintia: Change Workspace Folder`

### Changed

- Fix the error of parsing markdown
- Improve the style under the theme of **Light/Dark High Contrast**

---

## [0.1.4] - 2022/09/09

### Added

- Add [snippets](https://github.com/jinzcdev/vscode-pintia#15-snippets) of C/CPP template

### Changed

- Fix the last submitted code can't be copied
- Change the icon of Pintia

---

## [0.1.3] - 2022/08/26

### Added

- Show the last submitted code in the preview of problems

### Fixed

- Fix that images not showing

---

## [0.1.2] - 2022/07/29

### Added

- Add `CHANGELOG_zh-CN.md`

### Changed

- Optimize the size of the package
- Fix the issue where the message "Waiting for login" is still displayed when login is cancelled.

---

## [0.1.1] - 2022/07/28

### Changed

- Fix the issue that user's session cannot be saved (i.e., you had to log in again when opening VS Code)

### Removed

- Remove the tip for users to cancel signin

---

## [0.1.0] - 2022/07/27

### Added

- Sign in/out to Pintia(PTA) with WeChat QRCode
- Show public problems in explorer
- Preview the problem in the VS Code
- Submit/Test solutions to Pintia
- Add multiple custom test samples in editor
- Check in the education supermarket of Pintia
