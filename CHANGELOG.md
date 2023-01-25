# 更新日志

[English Docs](https://github.com/jinzcdev/vscode-pintia/blob/main/docs/CHANGELOG_en-US.md)

---

## [0.3.1] - 2023/01/25

### 更新

- 在创建题目源文件时，在工作目录下自动创建其题目集文件夹，并添加对应的配置项

---

## [0.3.0] - 2023/01/24

### 新增

- 添加插件演练以指导如何使用该插件，在命令面板中键入 `Get Started: Open Walkthroughs..`
- 增加题目搜索功能，及其对应命令 `Pintia: Search Problem`
- 根据 VS Code 的使用语言自动切换中英文
- 在代码编辑器中添加 `Preview` 快捷命令以重新预览题目
- 添加 Java 语言的常用模板（BufferReader、Scanner）
- 在题目预览中，增加搜索引擎与题解入口以快速搜索题目

### 更新

- 修复提交测试时的错误
- 添加自定义样例时，由 `Line Comment` 改为 `Block Comment`

---

## [0.2.1] - 2022/11/29

### 更新

- 修复 `Output` 视图名称错误 (Pinta -> PTA (Pintia))
- 将文档的默认语言改为中文

## [0.2.0] - 2022/09/17

### 新增

- 高亮预览的代码
- 添加修改当前工作区的命令 `Pintia: Change Workspace Folder`

### 更新

- 修复 Markdown 解析错误
- 修复高对比度主题下页面样式

---

## [0.1.4] - 2022/09/09

### 新增

- 增加 C/CPP 代码模板的 [Snippets](https://github.com/jinzcdev/vscode-pintia#15-snippets)

### 更新

- 修复最后一次提交的代码不能被复制的问题
- 更改插件图标

---

## [0.1.3] - 2022/08/26

### 新增

- 在题目的预览中显示最后一次提交的代码

### 更新

- 修复题目预览中的图片不显示问题

---

## [0.1.2] - 2022/07/29

### 新增

- 增加 `CHANGELOG_zh-CN.md` 中文文档

### 更新

- 优化插件包的大小
- 修复用户取消登录时，仍然提示“等待登录”

---

## [0.1.1] - 2022/07/28

### 更新

- 修复了用户Session不能被保存的问题（即再次打开 VS Code 时需要重新登录）

### 移除

- 移除用户取消登录后的提示

---

## [0.1.0] - 2022/07/27

### 新增

- 使用微信 QRCode 登录/退出 Pintia（PTA）。
- 在 Explorer 中显示 **公共题集**
- 在 VS Code 中预览题目
- 向 Pintia 提交/测试你的 Solution
- 在编辑器中添加 **多个自定义测试样例**
- 自动签到 Pintia 的教育超市
