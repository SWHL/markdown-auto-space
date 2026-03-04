# Markdown Auto Space 规则说明

本扩展在编辑器中会以规则码（MAS001–MAS005）标注违反处，与 markdownlint 的 MDxxx 用法一致。下表为规则码与配置键、说明的对应关系。

| 规则码 | 配置键（`markdownAutoSpace.rules`） | 说明 |
|--------|-----------------------------------|------|
| **MAS001** | `MAS001` | 中英文/数字之间应有空格 |
| **MAS002** | `MAS002` | 中文与行内代码（反引号）之间应有空格 |
| **MAS003** | `MAS003` | 中文与链接/URL 之间应有空格 |
| **MAS004** | `MAS004` | 英文/数字间的顿号应改为逗号+空格 |
| **MAS005** | `MAS005` | 斜杠与中文之间应有空格 |

在 VS Code 中开启 `markdownAutoSpace.diagnostics.enable` 后，违反上述规则的位置会显示波浪线，悬停可看到规则码与说明。

---

<a id="mas001"></a>

## MAS001 — chineseAlnum：中文与英文/数字之间加空格

在中文与英文字母、数字之间插入空格。

| 输入 | 输出 |
|------|------|
| `RapidOCR是一款开源OCR工具` | `RapidOCR 是一款开源 OCR 工具` |
| `Python3以上版本` | `Python3 以上版本` |
| `价格100元` | `价格 100 元` |
| `在2024年发布` | `在 2024 年发布` |
| `测试(test)内容` | `测试 (test) 内容` |
| `使用C++开发` | `使用 C++ 开发` |

配置键：`markdownAutoSpace.rules.MAS001`，默认 `true`。

---

<a id="mas002"></a>

## MAS002 — chineseBacktick：中文与行内代码（反引号）之间加空格

在中文与行内代码之间插入空格。

| 输入 | 输出 |
|------|------|
| `使用\`rapidocr\`库` | `使用 \`rapidocr\` 库` |
| `\`code\`块测试` | `\`code\` 块测试` |
| `测试\`code\`块` | `测试 \`code\` 块` |

配置键：`markdownAutoSpace.rules.MAS002`，默认 `true`。

---

<a id="mas003"></a>

## MAS003 — chineseLinkUrl：中文与链接/URL 之间加空格

在中文与 Markdown 链接、裸 URL 之间插入空格；链接或 URL 本身会被保护，仅在其与中文的边界加空格。链接文本内的中英文仍按 MAS001 处理。

| 输入 | 输出 |
|------|------|
| `访问https://github.com/RapidAI/RapidOCR项目` | `访问 https://github.com/RapidAI/RapidOCR 项目` |
| `查看[RapidOCR文档](https://rapidai.github.io/RapidOCRDocs)` | `查看 [RapidOCR 文档](https://rapidai.github.io/RapidOCRDocs)` |
| `更多的更新日志请查看[CHANGELOG](./CHANGELOG.md)` | `更多的更新日志请查看 [CHANGELOG](./CHANGELOG.md)` |

配置键：`markdownAutoSpace.rules.MAS003`，默认 `true`。

---

<a id="mas004"></a>

## MAS004 — dunhaoToComma：英文/数字间的顿号改为逗号+空格

当中文顿号（、）出现在英文或数字之间时，替换为英文逗号加空格（, ）。

| 输入 | 输出 |
|------|------|
| `支持Python、Java、C++` | `支持 Python, Java, C++` |
| `支持C++、Java、Python语言` | `支持 C++, Java, Python 语言` |

配置键：`markdownAutoSpace.rules.MAS004`，默认 `true`。

---

<a id="mas005"></a>

## MAS005 — slashSpace：斜杠与中文之间应有空格

仅在斜杠（/）**一侧为中文**时，在斜杠与两侧内容之间插入空格；两侧均为英文/数字时不加空格（如路径 `path/to/file`、分支名 `release/v3.0`、`CPU/GPU`）。

| 输入 | 输出 |
|------|------|
| `构建/工具等` | `构建 / 工具等` |
| `前端/后端开发` | `前端 / 后端开发` |
| `CPU/GPU切换` | `CPU/GPU 切换`（两侧英文不加） |
| `Python/Java语言` | `Python/Java 语言` |
| `测试A/B方案` | `测试 A/B 方案` |
| `切换到release/v3.0分支` | `切换到 release/v3.0 分支` |

配置键：`markdownAutoSpace.rules.MAS005`，默认 `true`。

---

## 关闭某条规则

在设置中用规则码将对应规则设为 `false` 即可，例如只关闭斜杠规则（MAS005）：

```json
{
  "markdownAutoSpace.rules": {
    "MAS005": false
  }
}
```

关闭多条规则示例：

```json
{
  "markdownAutoSpace.rules": {
    "MAS001": false,
    "MAS005": false
  }
}
```

关闭后，该规则既不会在保存/格式化时生效，也不会在编辑器中显示对应诊断。
