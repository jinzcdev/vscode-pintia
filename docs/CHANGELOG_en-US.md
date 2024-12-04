# Change Log

[中文文档](https://github.com/jinzcdev/vscode-pintia/blob/main/CHANGELOG.md)

---

## [0.6.0] - 2024/12/04

### Added

- Added local problem preview history and plugin configuration items
- Optimized the prefix number of "Favorites" problems

---

## [0.5.7] - 2024/12/01

### Updated

- The plugin name has been changed to `Pintia (拼题A)`

### Fixed

- Fixed the issue where the locked icon was not displayed for unlocked problem sets in the problem set list
- Fixed the issue where the `Copy` string was included in the content copied by the Copy button
- Code on the submission page now supports copying
- Some latex formulas in problems cannot be parsed
- Line break issue in problem preview

---

## [0.5.6] - 2024/11/28

### Fixed

- Fixed the code style issue in the webview of the submission page

---

## [0.5.5] - 2024/11/24

### Added

- Added configuration item `pintia.codeColorTheme` for code preview themes, supporting themes: `atom-one`, `github`, `a11y`, `stackoverflow`, `kimbie`

### Updated

- The webview title of the problem preview now displays the problem name

### Fixed

- Modified the style of the problem preview
- Fixed the issue where images could not be displayed in certain situations
- Corrected the problem's jump link

---

## [0.5.4] - 2023/09/10

### Bug

- The structure of the 'organization' field in the problem model changes

---

## [0.5.3] - 2023/06/08

### Bug

- Fixed the issue that there is no the last submitted code on the problem view.

---

## [0.5.2] - 2023/05/09

### Bug

- Fixed the API for getting problem information and the last submission

---

## [0.5.0] - 2023/02/28

### Added

- Added the **My Favorites**. You can click the button on the right side of the problem to add it to your favorites (only stored locally)
- Added configuration item `pintia.searchIndex.ignoreLockedProblemSets`: whether to filter unlocked problem sets when searching for problems

### Changed

- Show `viewWelcome` component when user is not logged in to guide user to use the plugin
- When a user is already logged in, clicking Login will bring up a `Confirm` prompt

---

## [0.4.0] - 2023/02/15

### Added

- Add **notebook** feature. Now, you can type `ptanote` in the code editor to generate a **note block**, where you can enter your notes, and the next time you preview the problem, the notes will be parsed and previewed in Markdown

---

## [0.3.1] - 2023/01/25

### Changed

- When creating a problem source file, the problem set folder is automatically created in the workspace directory and the corresponding configuration is added to settings

---

## [0.3.0] - 2023/01/24

### Added

- Add the Walkthroughs to instruct how to use this extension. Type `Get Started: Open Walkthroughs...` in the Command Palette
- Add problem search and its corresponding command `Pintia: Search Problem`
- Automatically switch between English and Chinese according to the language of VS Code
- Add `Preview` shortcut command in the code editor to re-preview a problem
- Common templates for Java (BufferReader, Scanner)
- Add search engine and `Solution` link for quick search in problem preview

### Changed

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
