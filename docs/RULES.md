# Markdown Auto Space 规则说明

本扩展在编辑器中会以规则码（MAS001–MAS009）标注违反处，与 markdownlint 的 MDxxx 用法一致。下表为规则码与配置键、说明的对应关系。

## 与《中文文案排版指北》空格小节的对照

参考 [sparanoid/chinese-copywriting-guidelines](https://github.com/sparanoid/chinese-copywriting-guidelines)「空格」一节：

| 指北条目 | 对应规则 |
|---------|----------|
| 中英文之间加空格 | **MAS001** |
| 中文与数字之间加空格 | **MAS001** |
| 数字与单位之间加空格（如 10 Gbps, 20 TB） | **MAS007** |
| 度数、百分号与数字之间 **不** 加空格 | **MAS008** |
| 全形逗号、句号等与其他字符间不加空格 | **MAS009**（见下「例外」） |
| 产品名按官方书写（如「豆瓣 FM」） | 不自动处理，需人工或白名单 |

行内代码、链接边界等仍由 MAS002, MAS003, MAS006 等配合；指北中「超连结之间增加空格」属争议项，本扩展未单独做规则。

---

| 规则码 | 配置键（`markdownAutoSpace.rules`） | 说明 |
|--------|-----------------------------------|------|
| **MAS001** | `MAS001` | 中英文/数字之间应有空格 |
| **MAS002** | `MAS002` | 中文与行内代码（反引号）之间应有空格 |
| **MAS003** | `MAS003` | 中文与链接/URL 之间应有空格 |
| **MAS004** | `MAS004` | 英文/数字间的顿号应改为逗号+空格 |
| **MAS005** | `MAS005` | 斜杠与中文之间应有空格 |
| **MAS006** | `MAS006` | 超链接 [] 内中英文混排时英文左右应有空格 |
| **MAS007** | `MAS007` | 数字与单位之间应有空格 |
| **MAS008** | `MAS008` | 度数、百分号与数字之间不应有空格 |
| **MAS009** | `MAS009` | 全形句读标点旁不应有空格 |

在 VS Code 中开启 `markdownAutoSpace.diagnostics.enable` 后，违反上述规则的位置会显示波浪线，悬停可看到规则码与说明。修改 `markdownAutoSpace.rules` 或 `markdownAutoSpace.units` 后，已打开文档的诊断会立即刷新。

## 代码块保护

格式化和诊断会跳过 Markdown 围栏代码块。支持反引号和波浪线围栏，围栏长度至少为 3 个字符，也支持围栏后的语言标识以及最多 3 个空格的缩进：

``````markdown
~~~python
中文English
~~~~

````ts
中文English
`````
``````

起始围栏和结束围栏必须使用相同字符，且结束围栏的长度不能短于起始围栏。结束标记后只能有空白，不能带语言标识或其他文本；反引号起始围栏后的语言标识不能包含反引号。代码内容中的短围栏或不同字符围栏不会提前结束代码块。未闭合围栏会采用保守策略，后续内容不会被格式化或诊断。

## 局部忽略

如果只有文档中的一小段需要保留品牌名、模板语法或特殊排版，可使用 markdownlint 风格的 HTML 注释指令：

为便于输入，指令支持 `mas-` 短别名；完整的 `markdown-auto-space-` 写法也继续有效。以下两种写法等价：

```md
<!-- mas-disable MAS005 -->
<!-- markdown-auto-space-disable MAS005 -->
```

```md
<!-- markdown-auto-space-disable -->
这里保持原样English/模板
<!-- markdown-auto-space-enable -->
```

不带规则码时忽略全部规则；也可以只忽略指定规则：

```md
<!-- markdown-auto-space-disable MAS005 MAS009 -->
前端/后端，保留特殊排版
<!-- markdown-auto-space-enable MAS005 MAS009 -->
```

下一行忽略使用：

```md
<!-- markdown-auto-space-disable-next-line MAS005 -->
前端/后端
```

这里的 `disable-next-line` 是“忽略指令后紧接着的一行”，不是忽略注释所在行。例如上例中，`前端/后端` 不会应用 MAS005，也不会产生 MAS005 诊断；再下一行会恢复正常处理。

本扩展**不支持** `disable-line` 和行尾指令。它们与 `disable-next-line` 的区别如下：

| 形式 | 作用对象 | 当前是否支持 |
|------|----------|--------------|
| `<!-- markdown-auto-space-disable-line MAS005 -->` | 指令所在行 | 否 |
| `文本 <!-- markdown-auto-space-disable-line MAS005 -->` | 包含指令的正文行 | 否 |
| `<!-- markdown-auto-space-disable-next-line MAS005 -->` | 指令后的下一行 | 是 |

因此，不要写成下面这样来尝试忽略下一行：

```md
<!-- markdown-auto-space-disable-line MAS005 -->
前端/后端
```

应改用：

```md
<!-- markdown-auto-space-disable-next-line MAS005 -->
前端/后端
```

`disable-next-line` 标记必须独占一行。规则码仅接受 `MAS001`–`MAS009`，未知规则码不会关闭任何规则。块级 `disable/enable` 不建立嵌套层，重复 `disable` 不增加层级，遇到对应 `enable` 即恢复；未闭合的 `disable` 会保守地忽略到文档末尾。所有局部忽略指令行不会格式化或产生诊断。代码围栏和 YAML front matter 内的同名注释仍按各自保护规则处理，不会改变局部忽略状态。

`disable-next-line` 严格只消费紧接着的一行。即使目标行是水平分隔线、代码围栏行或缩进代码行，也不会把忽略状态延续到后面的正文。

在 Markdown 文件中输入忽略指令的规则码时，VS Code 会提供 `MAS001`–`MAS009` 的补全；将鼠标悬停在规则码上会显示规则说明、典型输入/输出示例以及完整规则文档链接。普通正文中的 `MAS005` 等文本不会触发这些提示。

输入忽略指令的开头时也会自动提供指令补全。例如输入 `<!-- mas-` 后，可以选择 `mas-disable`、`mas-enable` 或 `mas-disable-next-line`；选择后再输入空格即可继续选择规则码。补全不会在未选择候选项时自动改写正文。

补全和悬停只对完整的、独占一行的 HTML 注释指令生效；普通正文、其他 HTML 注释，以及注释结束符 `-->` 后的文本不会触发规则提示。一个指令中已经写过的规则码不会重复出现在补全列表中。

---

<a id="mas001"></a>

## MAS001 — chineseAlnum：中文与英文 / 数字之间加空格

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

## MAS003 — chineseLinkUrl：中文与链接 /URL 之间加空格

在中文与 Markdown 链接、裸 URL 之间插入空格；链接或 URL 本身会被保护，仅在其与中文的边界加空格。链接文本（`[]` 内）的中英文混排由 **MAS006** 处理。

| 输入 | 输出 |
|------|------|
| `访问https://github.com/RapidAI/RapidOCR项目` | `访问 https://github.com/RapidAI/RapidOCR 项目` |
| `查看[RapidOCR文档](https://rapidai.github.io/RapidOCRDocs)` | `查看 [RapidOCR 文档](https://rapidai.github.io/RapidOCRDocs)` |
| `更多的更新日志请查看[CHANGELOG](./CHANGELOG.md)` | `更多的更新日志请查看 [CHANGELOG](./CHANGELOG.md)` |

配置键：`markdownAutoSpace.rules.MAS003`，默认 `true`。

---

<a id="mas004"></a>

## MAS004 — dunhaoToComma：英文 / 数字间的顿号改为逗号+ 空格

当中文顿号（、）出现在英文或数字之间时，替换为英文逗号加空格（,）。

| 输入 | 输出 |
|------|------|
| `支持Python、Java、C++` | `支持 Python, Java, C++` |
| `支持C++、Java、Python语言` | `支持 C++, Java, Python 语言` |

配置键：`markdownAutoSpace.rules.MAS004`，默认 `true`。

---

<a id="mas005"></a>

## MAS005 — slashSpace：斜杠与中文之间应有空格

仅在斜杠（/）**一侧为中文** 时，在斜杠与两侧内容之间插入空格；两侧均为英文 / 数字时不加空格（如路径 `path/to/file`、分支名 `release/v3.0`、`CPU/GPU`）。

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

<a id="mas006"></a>

## MAS006 — chineseLinkText：超链接 [] 内中英文混排时英文左右加空格

在 Markdown 超链接的文本部分（方括号 `[]` 内）出现中英文混排时，在中文与英文 / 数字之间插入空格。链接文本在恢复占位符时还会应用 **MAS007–MAS009**（与正文一致）。

| 输入 | 输出 |
|------|------|
| `[配置自动移除未使用的import](https://example.com)` | `[配置自动移除未使用的 import](https://example.com)` |
| `[查看RapidOCR文档](https://rapidai.github.io/RapidOCRDocs)` | `[查看 RapidOCR 文档](https://rapidai.github.io/RapidOCRDocs)` |

配置键：`markdownAutoSpace.rules.MAS006`，默认 `true`。

---

<a id="mas007"></a>

## MAS007 — digitUnitSpace：数字与单位之间加空格

在阿拉伯数字（可含一位小数，如 `2.5`）与常见单位之间插入空格，例如存储、带宽、频率、电量等。

| 输入 | 输出 |
|------|------|
| `宽带有10Gbps` | `宽带有 10 Gbps` |
| `SSD一共有20TB` | `SSD 一共有 20 TB` |
| `频率2.5GHz` | `频率 2.5 GHz` |

**单位表（节选）**：`Gbps`、`Mbps`、`Kbps`、`TB`/`GB`/`MB`/`KB`、`TiB`/`GiB`/`MiB`/`KiB`、`GHz`/`MHz`/`kHz`/`Hz`、`mAh`、`ms`、`ns`、`px`、`dpi`、`V`、`W`、`bps`、`THz` 等；未列入的常见单位可提 issue 扩展。

**未覆盖**：`4K`、`1080p` 等习惯连写；紧贴字母数字的产品型号（如 `Python3`）不会误拆。

可通过 `markdownAutoSpace.units` 扩展单位，而无需复制默认列表：

```json
{
  "markdownAutoSpace.units": {
    "additional": ["rpm", "kWh", "μm"],
    "exclude": ["V"]
  }
}
```

`additional` 和 `include` 中的单位会合并追加，`exclude` 会从默认及追加列表中移除单位。非法、空白和重复值会忽略；单位会转义后再构造并缓存正则。配置同时影响正文和超链接文本的格式化及 MAS007 诊断。图片说明、行内代码和链接地址仍受保护。

配置键：`markdownAutoSpace.rules.MAS007`，默认 `true`。

---

<a id="mas008"></a>

## MAS008 — tightDegreePercent：度数、百分号与数字之间不空格

去掉数字与 `°`、`%`、`％` 之间的 ASCII 空格（指北中的错误示例：`90 °`、`15 %`）；`°`/`%` 与后面紧跟的中文之间会保留一个空格（如 `90° 的角`、`15% 的`）。

| 输入 | 输出 |
|------|------|
| `新 MacBook 有 15 % 提升` | `新 MacBook 有 15% 提升` |
| `角度为 90 ° 的角` | `角度为 90° 的角` |

配置键：`markdownAutoSpace.rules.MAS008`，默认 `true`。

---

<a id="mas009"></a>

## MAS009 — noSpaceAroundCjkPunct：全形句读标点旁不留空格

去掉 **全形逗号、句号、叹号、分号、顿号、省略号** 以及 **引号、括号内侧** 等处多余的 ASCII 空格。
**不在** `【》《「『（` **前** 删空格，以便保留 `console.log 【…` 这类英文与左括号之间的空格。

| 输入 | 输出 |
|------|------|
| `买了 iPhone ，好开心` | `买了 iPhone，好开心` |
| `今天出去， 很开心` | `今天出去，很开心` |
| `他说「 你好」` | `他说「你好」` |

配置键：`markdownAutoSpace.rules.MAS009`，默认 `true`。

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

关闭后，该规则既不会在保存 / 格式化时生效，也不会在编辑器中显示对应诊断。

## 排除文件

`markdownAutoSpace.exclude` 接受 VS Code glob 数组。匹配的 Markdown 文件会完全跳过：手动保存格式化、扩展命令、标准 Format Document 提供器和诊断都不会处理它们。

```json
{
  "markdownAutoSpace.exclude": [
    "**/CHANGELOG.md",
    "**/generated/**"
  ]
}
```

工作区内的模式相对文件所属的工作区根目录匹配；多根工作区中的每个根分别计算。工作区外的文档按完整文档路径匹配。VS Code Web 中的虚拟工作区也使用所属工作区根作为基准；不属于工作区的非文件 URI 仅在其 URI 路径被模式匹配时排除。
