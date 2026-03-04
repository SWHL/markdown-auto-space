<p align="center">
  <img src="https://raw.githubusercontent.com/SWHL/markdown-auto-space/refs/heads/main/res/icon.jpg" width="160px"/>
</p>

# Markdown Auto Space

> 在保存或格式化时，自动为 Markdown 中的中英文之间添加空格。

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SWHL.markdown-auto-space)

## 概述

中文与英文、数字混排时，在两者之间增加空格可提升可读性。本扩展在 VS Code 中针对 **Markdown** 文件，在保存或执行「格式化文档」时自动应用一套可配置的规则，对中英文、数字、链接、行内代码、斜杠等之间插入或规范化空格。

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

在 VS Code 扩展市场搜索 **Markdown Auto Space**，或运行：

```bash
code --install-extension SWHL.markdown-auto-space
```

## 配置

| 配置项                                       | 默认值     | 类型                  | 说明                       |
| ----------------------------------------- | ------- | ------------------- | ------------------------ |
| `markdownAutoSpace.diagnostics.enable`     | `true`  | `boolean`           | 是否在编辑器中显示规则违反处的波浪线提示（类似 markdownlint） |
| `markdownAutoSpace.formatOnSave`          | `true`  | `boolean`           | 仅在你手动保存（如 Ctrl+S）时加空格，自动保存不触发 |
| `markdownAutoSpace.formatOnDocument`      | `false` | `boolean`           | 执行「格式化文档」时加空格            |
| `markdownAutoSpace.spaceType`             | `'all'` | `'all' | 'comment'` | 作用范围（当前为全部内容）            |
| `markdownAutoSpace.rules`                 | 见 [RULES.md](./docs/RULES.md) | `object` | 各条规则的开关（MAS001–MAS005），未写出的规则默认为 `true` |

本扩展仅处理 **Markdown** 文件（语言 ID 为 `markdown`），不处理 txt 等其他类型。

### 诊断（规则提示）

开启 `markdownAutoSpace.diagnostics.enable` 后，在 Markdown 中违反「中英文加空格」等规则的位置会显示波浪线，悬停可见规则码与说明，例如：

- **MAS001**：中英文/数字之间应有空格
- **MAS002**：中文与行内代码（反引号）之间应有空格
- **MAS003**：中文与链接/URL 之间应有空格
- **MAS004**：英文/数字间的顿号应改为逗号+空格
- **MAS005**：斜杠与中文之间应有空格

与 markdownlint 的 MD022 等提示方式一致；悬停时规则码（如 MAS001）可点击，跳转到 [规则说明文档](./docs/RULES.md) 对应条目。可逐处修改，或使用「Markdown Auto Space」命令整篇/选中区一键修复。

## 运行命令

除保存时自动加空格外，可手动执行 **Markdown Auto Space** 对当前文档加空格：

- **整篇格式化**：命令面板输入「Markdown Auto Space」或从编辑器标题/右键菜单选择「Markdown Auto Space: 对当前文档执行中英文加空格」。
- **仅格式化选中**：选中一行或多行后，命令面板输入「Markdown Auto Space 格式化选中」或从菜单选择「Markdown Auto Space: 仅格式化选中行/选区」；未选中时则格式化当前光标所在行。

未打开 Markdown 文件或当前文件不是 Markdown 时，运行命令会给出提示。

## 规则说明与示例

规则码 MAS001–MAS005 的说明、输入/输出示例及配置方式见 **[规则说明文档](./docs/RULES.md)**。

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

## 关闭某条规则

在设置中用规则码将对应规则设为 `false` 即可，例如只关闭斜杠规则（MAS005）：

```json
{
  "markdownAutoSpace.rules": {
    "MAS005": false
  }
}
```

更多规则开关说明见 [docs/RULES.md](./docs/RULES.md)。

## 查看运行日志

若扩展未按预期工作，可查看运行日志排查：

1. 菜单 **查看** → **输出**（或 `Ctrl+Shift+U` / `Cmd+Shift+U`）
2. 在输出面板右上角的下拉框中选择 **Markdown Auto Space**
3. 保存一个 `.md` 文件或执行命令「Markdown Auto Space」后，日志会记录是否激活、是否识别为 Markdown、是否产生编辑以及 `applyEdit` 是否成功

若日志里出现「跳过: 非 Markdown 文件」，请确认当前文件右下角语言模式为 **Markdown**（点击可切换）。

## 更新日志

更多版本与改动见 [CHANGELOG](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE) © [SWHL](https://github.com/SWHL)
