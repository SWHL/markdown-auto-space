<p align="center">
  <img src="https://raw.githubusercontent.com/SWHL/markdown-auto-space/main/res/icon.jpg" width="160px"/>
</p>

# Markdown Auto Space

> 在保存或格式化时，自动为 Markdown 中的中英文之间添加空格。

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=SWHL.markdown-auto-space)

## 概述

中文与英文、数字混排时，在两者之间增加空格可提升可读性。本扩展在 VS Code 中针对 **Markdown** 文件，在保存或执行「格式化文档」时自动应用一套可配置的规则，对中英文、数字、链接、行内代码、斜杠等之间插入或规范化空格。

处理时会**保护**以下内容不被破坏，仅在其与中文的边界加空格：

- Markdown 链接：`[文本](url)`
- 图片：`![alt](url)`（图片 URL 内的斜杠等不参与空格规则）
- 粗体：`**文本**`
- 独立 URL（如 `https://...`）
- 行内代码：反引号 `` ` `` 包裹的内容整体保护，内部不参与任何空格规则
- HTML 标签

代码块（```）和 YAML front matter（`---`）内的行会整体跳过，不参与处理。

## 安装

在 VS Code 扩展市场搜索 **Markdown Auto Space**，或运行：

```bash
code --install-extension SWHL.markdown-auto-space
```

## 配置

| 配置项                                  | 默认值     | 类型                  | 说明                       |
| ------------------------------------ | ------- | ------------------- | ------------------------ |
| `markdownAutoSpace.formatOnSave`     | `true`  | `boolean`           | 保存文件时自动加空格               |
| `markdownAutoSpace.formatOnDocument` | `false` | `boolean`           | 执行「格式化文档」时加空格            |
| `markdownAutoSpace.spaceType`        | `'all'` | `'all' | 'comment'` | 作用范围（当前为全部内容）            |
| `markdownAutoSpace.rules`            | 见下文     | `object`            | 各条规则的开关，未写出的规则默认为 `true` |

本扩展仅处理 **Markdown** 文件（语言 ID 为 `markdown`），不处理 txt 等其他类型。

## 规则说明与示例

以下规则均可在 `markdownAutoSpace.rules` 中单独开启或关闭，默认全部为 `true`。格式示例为：**输入** → **输出**。

---

### chineseAlnum — 中文与英文/数字之间加空格

在中文与英文字母、数字之间插入空格。

| 输入                   | 输出                      |
| -------------------- | ----------------------- |
| `RapidOCR是一款开源OCR工具` | `RapidOCR 是一款开源 OCR 工具` |
| `Python3以上版本`        | `Python3 以上版本`          |
| `价格100元`             | `价格 100 元`              |
| `在2024年发布`           | `在 2024 年发布`            |
| `测试(test)内容`         | `测试 (test) 内容`          |
| `使用C++开发`            | `使用 C++ 开发`             |

配置示例：

```json
{
  "markdownAutoSpace.rules": {
    "chineseAlnum": true
  }
}
```

---

### chineseBacktick — 中文与行内代码（反引号）之间加空格

在中文与 行内代码 之间插入空格。

| 输入              | 输出                |
| --------------- | ----------------- |
| `使用\`rapidocr库` | `使用 \`rapidocr 库` |
| `\`code块测试`     | `\`code 块测试`      |
| `测试\`code块`     | `测试 \`code 块`     |

配置示例：

```json
{
  "markdownAutoSpace.rules": {
    "chineseBacktick": true
  }
}
```

---

### chineseLinkUrl — 中文与链接/URL 之间加空格

在中文与 Markdown 链接、裸 URL 之间插入空格；链接或 URL 本身会被保护，仅在其与中文的边界加空格。链接文本内的中英文仍按 chineseAlnum 处理。

| 输入                                                       | 输出                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `访问https://github.com/RapidAI/RapidOCR项目`                | `访问 https://github.com/RapidAI/RapidOCR 项目`                |
| `查看[RapidOCR文档](https://rapidai.github.io/RapidOCRDocs)` | `查看 [RapidOCR 文档](https://rapidai.github.io/RapidOCRDocs)` |
| `更多的更新日志请查看[CHANGELOG](./CHANGELOG.md)`                  | `更多的更新日志请查看 [CHANGELOG](./CHANGELOG.md)`                   |

配置示例：

```json
{
  "markdownAutoSpace.rules": {
    "chineseLinkUrl": true
  }
}
```

---

### dunhaoToComma — 英文/数字间的顿号改为逗号+空格

当中文顿号（、）出现在英文或数字之间时，替换为英文逗号加空格（, ）。

| 输入                    | 输出                        |
| --------------------- | ------------------------- |
| `支持Python、Java、C++`   | `支持 Python, Java, C++`    |
| `支持C++、Java、Python语言` | `支持 C++, Java, Python 语言` |

配置示例：

```json
{
  "markdownAutoSpace.rules": {
    "dunhaoToComma": true
  }
}
```

---

### slashSpace — 斜杠两侧加空格（仅当一侧为中文时）

仅在斜杠（/）**一侧为中文**时，在斜杠与两侧内容之间插入空格；两侧均为英文/数字时不加空格（如路径 `path/to/file`、分支名 `release/v3.0`、`CPU/GPU`）。

| 输入                | 输出                   |
| ----------------- | -------------------- |
| `构建/工具等`          | `构建 / 工具等`           |
| `前端/后端开发`         | `前端 / 后端开发`          |
| `CPU/GPU切换`       | `CPU/GPU 切换`（两侧英文不加） |
| `Python/Java语言`   | `Python/Java 语言`      |
| `测试A/B方案`         | `测试 A/B 方案`          |
| `切换到release/v3.0分支` | `切换到 release/v3.0 分支` |

配置示例：

```json
{
  "markdownAutoSpace.rules": {
    "slashSpace": true
  }
}
```

---

## 其他行为说明

- **粗体**：粗体整体被保护，仅在与中文的边界加空格。
  例：`这是**重要内容**说明` → `这是 **重要内容** 说明`。
- **图片语法**：`![](url)` 或 `![alt](url)` 整体被保护，URL 内的斜杠等不参与任何空格规则。
  例：`见图![](../../images/fig.jpg)说明` → `见图 ![](../../images/fig.jpg) 说明`。
- **行内代码**：反引号包裹的内容整体被保护，内部不参与空格规则（如 `` `release/v3.0` `` 保持原样）。
- **HTML 标签**：标签整体被保护，仅在与中文的边界加空格。
  例：`</div>这是文本` → `</div> 这是文本`。
- **已有空格**：已有空格的不会被重复插入。
  例：`已经有 空格 的文本` 保持不变。
- **句号前**：英文/数字后的中文句号前不会加空格。
  例：`RapidOCR。这是句号` 保持不变。

## 关闭某条规则

在设置中将对应对规则设为 `false` 即可，例如只关闭斜杠规则：

```json
{
  "markdownAutoSpace.rules": {
    "slashSpace": false
  }
}
```

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
