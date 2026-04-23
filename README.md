<p align="center">
  <img src="https://raw.githubusercontent.com/SWHL/markdown-auto-space/refs/heads/main/res/icon.jpg" width="160px"/>
</p>

# Markdown Auto Space

> 在保存或格式化时，按可配置规则整理 Markdown 中的空格（中英混排、[中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines) 空格相关约定等）。

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SWHL.markdown-auto-space)

## 概述

中文与英文、数字混排时增加空格可提升可读性。本扩展在 VS Code 中针对 **Markdown** 文件，在 **手动保存** 或（可选）「格式化文档」时应用 **MAS001–MAS009** 共九条规则，例如：

| 方向 | 规则码 | 简述 |
|------|--------|------|
| 中英与数字边界 | MAS001–MAS006 | 中英文 / 数字、反引号、链接与 URL、顿号、斜杠、`[]` 内混排等 |
| 数字与单位 | **MAS007** | `10Gbps` → `10 Gbps`，`20TB` → `20 TB` |
| 度与百分号 | **MAS008** | `15 %`、`90 °` → `15%`、`90°`，且 `%`/`°` 后接中文时保留空格 |
| 全形标点旁 | **MAS009** | 去掉 `，`、`。` 等旁多余 ASCII 空格（不破坏 `log 【` 类写法） |

每条规则均可单独关闭，说明与示例见 **[docs/RULES.md](./docs/RULES.md)**。

处理时会 **保护** 以下内容不被破坏，仅在其与中文的边界加空格：

- Markdown 链接：`[文本](url)`
- 图片：`![alt](url)`（图片 URL 内的斜杠等不参与空格规则）
- 粗体：`**文本**`
- 独立 URL（如 `https://...`）
- 行内代码：反引号包裹内容整体保护（支持单 / 多反引号定界），内部任意内容不参与空格规则
- 引号内容：双引号 `"..."`、单引号 `'...'` 内的内容一律不参与空格规则
- HTML 标签

以下 **代码中内容** 一律不处理：围栏代码块（\`\`\`）、YAML front matter（`---`）内的行整体跳过；缩进代码块（行首 4 空格或 1 tab）的整行跳过；行内代码（反引号内）已在上面保护。

## 安装

支持 **VS Code 桌面版** 与 **Web 版**（[vscode.dev](https://vscode.dev)、[github.dev](https://github.dev)）。在对应环境的扩展市场搜索 **Markdown Auto Space**，或桌面版运行：

```bash
code --install-extension SWHL.markdown-auto-space
```

## 配置

| 配置项                                       | 默认值     | 类型                  | 说明                       |
| ----------------------------------------- | ------- | ------------------- | ------------------------ |
| `markdownAutoSpace.diagnostics.enable`     | `true`  | `boolean`           | 是否在编辑器中显示规则违反处的波浪线提示（类似 markdownlint） |
| `markdownAutoSpace.formatOnSave`          | `true`  | `boolean`           | 仅在你手动保存（如 Ctrl+S）时加空格，自动保存不触发 |
| `markdownAutoSpace.formatOnDocument`      | `false` | `boolean`           | 执行「格式化文档」时加空格            |
| `markdownAutoSpace.rules`                 | 见 [RULES.md](./docs/RULES.md) | `object` | 各条规则的开关（MAS001–MAS009），未写出的规则默认为 `true` |

本扩展仅处理 **Markdown** 文件（语言 ID 为 `markdown`），不处理 txt 等其他类型。
扩展按需激活：仅在打开 Markdown 文档或执行本扩展命令时加载，不会在普通工作区启动时提前激活。

### 诊断（规则提示）

开启 `markdownAutoSpace.diagnostics.enable` 后，在 Markdown 中违反「中英文加空格」等规则的位置会显示波浪线，悬停可见规则码与说明，例如：

- **MAS001**：中英文 / 数字之间应有空格
- **MAS002**：中文与行内代码（反引号）之间应有空格
- **MAS003**：中文与链接 /URL 之间应有空格
- **MAS004**：英文 / 数字间的顿号应改为逗号加空格
- **MAS005**：斜杠与中文之间应有空格
- **MAS006**：超链接 [] 内中英文混排时英文左右应有空格
- **MAS007**：数字与单位之间应有空格（如 10 Gbps, 20 TB）
- **MAS008**：度数、百分号与数字之间不应有空格
- **MAS009**：全形句读标点旁不应有空格

与 markdownlint 的 MD022 等提示方式一致；悬停时规则码（如 MAS001）可点击，跳转到 [规则说明文档](./docs/RULES.md) 对应条目。可逐处修改，或使用「Markdown Auto Space」命令整篇 / 选中区一键修复。

## 运行命令

除保存时自动加空格外，可手动执行 **Markdown Auto Space** 对当前文档加空格：

- **整篇格式化**：命令面板输入「Markdown Auto Space」或从编辑器标题 / 右键菜单选择「Markdown Auto Space: 对当前文档执行中英文加空格」。
- **仅格式化选中**：选中一行或多行后，命令面板输入「Markdown Auto Space 格式化选中」或从菜单选择「Markdown Auto Space: 仅格式化选中行 / 选区」；未选中时则格式化当前光标所在行。

未打开 Markdown 文件或当前文件不是 Markdown 时，运行命令会给出提示。

## 规则说明与示例

规则码 MAS001–MAS009 的说明、输入 / 输出示例及配置方式见 **[规则说明文档](./docs/RULES.md)**（含与 [中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines) 空格小节的对照）。**MAS007–MAS009** 对应指北中的数字与单位、度 / 百分号、全形标点旁空格等规则。

## 其他行为说明

- **粗体**：粗体整体被保护，仅在与中文的边界加空格。
  例：`这是**重要内容**说明` → `这是 **重要内容** 说明`。
- **图片语法**：`![](url)` 或 `![alt](url)` 整体被保护，URL 内的斜杠等不参与任何空格规则。
  例：`见图![](../../images/fig.jpg)说明` → `见图 ![](../../images/fig.jpg) 说明`。
- **行内代码**：反引号包裹的内容整体被保护，支持单 / 多反引号定界，内部任意内容不参与空格规则（如 `` `release/v3.0` ``、`` `**text**` ``、`` ``a ` b / 中文English`` `` 保持原样）。
- **引号内容**：双引号、单引号内的内容一律不处理（如 `"EN中文"`、`'path/to'` 保持原样）。
- **嵌套保护稳定恢复**：对“保护内容里再含保护内容”的场景进行递归恢复，不会出现 `__PROTECTED_x__` 泄漏到最终文本。
- **代码块**：围栏代码块（\`\`\`）内行、缩进代码块（行首 4 空格或 1 tab）的整行，均不参与处理。
- **HTML 标签**：标签整体被保护，仅在与中文的边界加空格。
  例：`</div>这是文本` → `</div> 这是文本`。
- **已有空格**：已有空格的不会被重复插入。
  例：`已经有 空格 的文本` 保持不变。
- **句号前**：英文 / 数字后的中文句号前不会加空格。
  例：`RapidOCR。这是句号` 保持不变。
- **MAS007（数字与单位）**：正文与超链接 `[]` 内文本均会处理（单位表见 RULES.md）。
  例：`宽带有10Gbps` → `宽带有 10 Gbps`。
- **MAS008（度 / 百分号）**：收紧数字与符号间空格，并与后续中文留白。
  例：`15 %的` → `15% 的`；`90 °的角` → `90° 的角`。
- **MAS009（全形标点）**：如 `iPhone ，好` → `iPhone，好`。

## 关闭某条规则

在设置中用规则码将对应规则设为 `false` 即可，例如只关闭斜杠（MAS005）或新增规则：

```json
{
  "markdownAutoSpace.rules": {
    "MAS005": false,
    "MAS009": false
  }
}
```

更多规则开关说明见 [docs/RULES.md](./docs/RULES.md)。

## 更新日志

| 版本 | 摘要 |
|------|------|
| **0.0.7** | 优化格式化稳定性与选区处理；新增按 tag 自动生成 Release 草稿并上传 `.vsix`；精简 CI 与发布链路。详见 [CHANGELOG.md](./CHANGELOG.md)。 |
| 0.0.6 | 新增 MAS007–MAS009（指北空格：数字与单位、度 /%、全形标点旁空格）；诊断与配置同步。详见 [CHANGELOG.md](./CHANGELOG.md)。 |
| 0.0.5 及更早 | MAS006, Web 版、诊断与 MAS001–MAS005 等，见 CHANGELOG。 |

完整历史见 **[CHANGELOG.md](./CHANGELOG.md)**。

## 查看运行日志

若扩展未按预期工作，可查看运行日志排查：

1. 菜单 **查看** → **输出**（或 `Ctrl+Shift+U` / `Cmd+Shift+U`）
2. 在输出面板右上角的下拉框中选择 **Markdown Auto Space**
3. 保存一个 `.md` 文件或执行命令「Markdown Auto Space」后，日志会记录是否激活、是否识别为 Markdown、是否产生编辑以及 `applyEdit` 是否成功

若日志里出现「跳过: 非 Markdown 文件」，请确认当前文件右下角语言模式为 **Markdown**（点击可切换）。

## 开发

常用本地校验命令：

```bash
pnpm lint
pnpm lint:fix
pnpm typecheck
pnpm test
pnpm package:vsix
```

发版相关脚本也全部直接使用 `pnpm`，不依赖 `ni` / `nr` / `nci`。

GitHub Actions 行为：

- `CI` 会在 `push` 到 `main` 和 `pull_request` 时自动顺序执行 `lint`、`typecheck`、`build`、`test`
- `Release` 会在你推送形如 `v*` 的 tag 时自动执行校验、打包 `.vsix`，并创建或更新同名版本的 GitHub Release 草稿
- 生成的 `.vsix` 会自动上传到该版本的 Release 草稿附件中；同一 tag 重跑时会覆盖旧附件
- `Release` 会校验 tag 是否等于 `v${package.json.version}`，避免 tag 版本与扩展版本漂移

发布新版本时的操作步骤：

1. 先把 `package.json` 中的 `version` 改成目标版本，例如 `0.0.7`
2. 提交代码
3. 打 tag，例如 `git tag v0.0.7`
4. 推送 tag，例如 `git push origin v0.0.7`

推送后，GitHub Actions 会自动校验版本一致性、打包 `.vsix`，并将产物放到 `v0.0.7` 对应的 Release 草稿下。
如果只打了 `v0.0.7`，但 `package.json.version` 不是 `0.0.7`，Release workflow 会直接失败。

## 参考资料

- [vscode-auto-space](https://github.com/Talljack/vscode-auto-space)
- [autocorrect](https://github.com/huacnlee/autocorrect)
- [markdownlint](https://github.com/DavidAnson/markdownlint)
- [中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines)（空格相关规则由 MAS007–MAS009 等覆盖）

## 许可证

[MIT](./LICENSE) © [SWHL](https://github.com/SWHL)
