# 更新日志

本文档记录本项目的所有重要变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [0.0.6] - 2026-03-18

### 新增

- **MAS007 — digitUnitSpace**：在阿拉伯数字与常见单位之间插入空格（如 `10Gbps` → `10 Gbps`，`20TB` → `20 TB`）。单位表含 `Gbps`、`TB`、`GHz`、`mAh` 等，见 [docs/RULES.md](./docs/RULES.md#mas007)。正文与超链接 `[]` 内文案均会处理。
- **MAS008 — tightDegreePercent**：去掉数字与 `°`、`%`、`％` 之间的多余空格（如 `15 %` → `15%`）；`°`/`%` 后紧跟中文时保留一个空格（如 `90° 的角`、`15% 的`），与指北示例一致。
- **MAS009 — noSpaceAroundCjkPunct**：去掉全形逗号、句号、叹号等句读标点两侧的 ASCII 空格；**不在** `【》《「『（` 前删空格，避免破坏 `console.log 【…` 等写法。
- **诊断**：上述三条规则在开启 `markdownAutoSpace.diagnostics.enable` 时显示波浪线，规则码 **MAS007–MAS009** 可点击跳转文档。
- **配置**：`markdownAutoSpace.rules` 增加 `MAS007`、`MAS008`、`MAS009` 布尔开关，默认 `true`。

### 变更

- **[README.md](./README.md)**：概述改为涵盖 MAS001–MAS009；补充规则一览表、MAS007–009 行为说明、版本摘要表与 CHANGELOG 入口。
- **[docs/RULES.md](./docs/RULES.md)**：增加与 [中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines)「空格」小节的对照表及 MAS007–009 专节。

### 其他

- 单元测试扩充（`applyDigitUnitSpace` / `applyTightDegreePercent` / `applyNoSpaceAroundCjkPunct`、`getLineViolations`、`getMarkdownSpaceViolations` 等）。

---

## [0.0.5] - 2026-03-17

### 新增

- **规则 MAS006**：超链接 `[]` 内中英文混排时，在英文左右添加空格。例如 `[配置自动移除未使用的import](url)` → `[配置自动移除未使用的 import](url)`。可通过 `markdownAutoSpace.rules.MAS006` 单独开关，详见 [docs/RULES.md](./docs/RULES.md)。

---

## [0.0.4] - 2026-03-04

### 新增

- **Web 端支持**：扩展现支持 VS Code for the Web（如 [vscode.dev](https://vscode.dev)、[github.dev](https://github.dev)），可在网页版扩展市场中安装使用，功能与桌面版一致。

---

## [0.0.3] - 2026-03-04

### 新增

- **诊断（规则提示）**：在编辑器中对违反「中英文加空格」等规则的位置显示波浪线，悬停可见规则码与说明（类似 markdownlint 的 MD022）。可通过 `markdownAutoSpace.diagnostics.enable` 开关。
- **诊断规则码可点击**：悬停时规则码（如 MAS001）为链接，点击跳转到 [docs/RULES.md](./docs/RULES.md) 对应规则说明。
- **规则码 MAS001–MAS005**：与诊断对应，配置中规则开关改为使用规则码（如 `MAS005: false`），见 [docs/RULES.md](./docs/RULES.md)。
- **VSCode 命令**：支持通过命令面板、编辑器标题右键、编辑区右键执行「Markdown Auto Space: 对当前文档执行中英文加空格」。
- **仅格式化选中**：新命令「Markdown Auto Space: 仅格式化选中行 / 选区」——选中多行时只对选区加空格，未选中时格式化当前光标所在行。
- **规则说明文档**：[docs/RULES.md](./docs/RULES.md) 单独列出 MAS001–MAS005 的说明、示例与配置方式。

### 变更

- **配置键**：`markdownAutoSpace.rules` 仅支持规则码 MAS001–MAS005，不再兼容旧键名（chineseAlnum, slashSpace 等）。
- **保存时修复**：仅在你 **手动保存**（如 Ctrl+S）时执行加空格，自动保存、失焦保存不触发，避免编辑时内容被自动改掉。
- **README**：规则详细说明与示例移至 [docs/RULES.md](./docs/RULES.md)，README 仅保留概述与导向。

### 修复

- 文档中含字面量 `__PROTECTED_数字__`（如 `__PROTECTED_99__`）且索引越界时，`restoreOnePass` 中 `item` 为 `undefined` 导致 `TypeError: Cannot read properties of undefined (reading 'match')`，现已修复并原样保留该字面量。

---

## [0.0.2] - 2025-03-03

### 新增

- 图片语法 `![](url)` / `![alt](url)` 整体保护，URL 内斜杠不参与空格规则
- 反引号包裹的行内代码整体保护，内部不参与任何空格规则（如 `` `release/v3.0` `` 保持原样）
- 行内代码保护支持单 / 多反引号定界，反引号内任意内容均不处理
- 斜杠规则（slashSpace）仅在一侧为中文时加空格，两侧均为英文 / 数字（如 `release/v3.0`、`CPU/GPU`）不再加空格
- 引号中的内容一律不处理：双引号 `"..."`、单引号 `'...'` 内的内容不参与任何空格规则
- 代码中内容一律不处理：缩进代码块（行首 4 空格或 1 tab）的整行跳过，不参与加空格

### 修复

- 空 alt 的图片语法 `![](...)` 此前未被保护，导致 URL 内 `/` 被加空格，现已修复
- 反引号内含粗体语法（如 `` `**text**` ``）时，粗体被误替换为占位符的问题（先保护反引号再保护粗体）
- 保护内容嵌套时可能出现的占位符泄漏问题（如输出 ````````__PROTECTED_0__````````），改为递归恢复后已修复

---

## [0.0.1] - 2025-03-02

- 首次发版
