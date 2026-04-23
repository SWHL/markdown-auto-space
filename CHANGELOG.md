# 更新日志

本文档记录本项目的所有重要变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [0.0.8] - 2026-04-23

### 新增

- **Marketplace 横向宣传图**：新增更接近真实 VS Code 编辑器截图风格的横向展示图，用于扩展商店详情页首屏展示。

### 变更

- **商店文案重写**：重写 [README.md](./README.md) 首屏结构，前置安装价值、规则覆盖范围、使用方式与搜索关键词，提升 Marketplace 详情页转化。
- **扩展元信息优化**：更新 `package.json` 中的描述、分类、关键词、命令标题、主页与问题反馈链接，补齐 Markdown 中文排版 / CJK spacing 相关搜索信号。
- **商店视觉统一**：README 主图改为 VS Code 窗口风格展示图，移除旧的品牌卡片式展示素材，保留单张主图以降低详情页噪音。
- **VSIX 体积收敛**：清理不再使用的 Marketplace 素材与临时文件，安装包仅保留实际引用的主图资源。

### 其他

- 新增宣传图生成脚本，便于后续在固定版式下继续迭代 Marketplace 展示素材。

## [0.0.7] - 2026-04-23

### 新增

- **自动发版工作流**：推送形如 `v*` 的 tag 后，GitHub Actions 会自动执行校验、打包 `.vsix`，并创建或更新对应版本的 GitHub Release 草稿，将 `.vsix` 作为附件上传。
- **版本一致性校验**：Release workflow 新增 tag 与 `package.json.version` 一致性检查，避免 `v0.0.7` 这类 tag 与扩展实际版本不一致时误发版。
- **开发命令整理**：新增并固定 `pnpm package:vsix` 作为本地与 CI 共用的 VSIX 打包命令。

### 变更

- **格式化编辑行为**：当文档内容格式化前后无变化时，不再返回全文替换 edit，避免无意义的 `applyEdit` 与文档脏状态抖动。
- **格式化文档接入方式**：移除对 VS Code 内置 `editor.action.formatDocument` 的覆盖，改为仅通过标准 `DocumentFormattingEditProvider` 提供格式化能力。
- **选区格式化与整篇格式化统一**：选区格式化现与整篇格式化共享跳过规则，YAML front matter、围栏代码块与缩进代码块中的内容不会再被误改。
- **按需激活**：扩展激活条件收紧为仅在 Markdown 文档或扩展命令触发时加载，不再在普通工作区启动时提前激活。
- **配置清理**：移除未实际生效的 `markdownAutoSpace.spaceType` 配置项，保持配置面与实现一致。
- **工程脚本与 CI**：测试脚本改为一次性运行；`lint` 改为纯检查并新增 `lint:fix`；CI 合并为单 job 顺序执行 `lint`、`typecheck`、`build`、`test`，减少重复安装依赖。
- **发布链路去除 ni 依赖**：发布脚本、CI 与 Release workflow 均改为直接使用 `pnpm`，不再依赖 `ni` / `nr` / `nci`。

### 修复

- **VSIX 打包内容**：修复本地生成的 `.tgz` 可能被误打进 `.vsix` 的问题，现已通过忽略规则排除。
- **Release 附件覆盖**：同一 tag 重跑 Release workflow 时，VSIX 附件会覆盖旧文件，避免重复或冲突。

### 其他

- 单元测试扩充至覆盖“无变化不返回 edit”“选区跨代码块/YAML front matter 跳过处理”“配置读取行为”等场景。
- ESLint 配置关闭与当前代码风格不匹配的低价值 JSDoc 规则，`pnpm lint` 现可稳定作为 CI 校验使用。

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
