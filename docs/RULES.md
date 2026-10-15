# Markdown Auto Space 规则说明

最低支持 VS Code v1.74.0（桌面版和 Web 版），与扩展清单中的 `engines.vscode: ^1.74.0` 一致。

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

## CLI 配置

命令行工具与 VS Code 共用下文的规则和保护逻辑。可在项目根目录放置 `.markdown-auto-space.json`（或 `markdown-auto-space.config.json`），也可使用 `--config` 指定文件：

```json
{
  "preset": "default",
  "rules": { "MAS001": true, "MAS007": false },
  "units": { "additional": ["rpm"], "exclude": ["V"] },
  "exclude": ["docs/generated/**"],
  "fileExtensions": [".md", ".mdx"]
}
```

运行 `markdown-auto-space <file|directory|glob> --check` 可在 CI 中检查格式；存在待修改内容时退出码为 `1`。使用 `--write` 写回文件，使用 `--diff` 输出统一 diff。

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

在 VS Code 中开启 `markdownAutoSpace.diagnostics.enable` 后，违反上述规则的位置会显示波浪线，悬停可看到规则码与说明。修改 `markdownAutoSpace.preset`、`markdownAutoSpace.rules` 或 `markdownAutoSpace.units` 后，已打开文档的诊断会立即刷新。

## 规则预设

`markdownAutoSpace.preset` 支持四个值：

- `default`：全部 MAS001–MAS009 开启，保持现有默认行为。
- `conservative`：只开启 MAS001、MAS002、MAS003 和 MAS007，减少对标点、斜杠及百分号空格的自动改写。
- `strict`：全部 MAS001–MAS009 开启。
- `custom`：使用逐条规则配置，未指定的规则保持开启，兼容原有 `markdownAutoSpace.rules` 行为。

预设先决定每条规则的基线，`markdownAutoSpace.rules` 中明确写出的规则再逐条覆盖。例如：

```json
{
  "markdownAutoSpace.preset": "conservative",
  "markdownAutoSpace.rules": {
    "MAS005": true,
    "MAS001": false
  }
}
```

此时 MAS005 会被重新开启，MAS001 会被关闭，其余规则沿用 `conservative`。切换预设后，已打开文档的诊断和后续格式化会立即使用新规则。

## Markdown 语法兼容性

格式化器会先识别 Markdown 结构，再处理可见文本，因此以下场景不会把语法内容误当成普通正文：引用块、嵌套列表、表格单元格、引用式链接、自动链接、多行 HTML/HTML 注释、常见 JSX/MDX 块、模板表达式以及反斜杠转义字符。未闭合的行内代码、链接、引号或模板表达式采用保守策略；引用定义行和完整 HTML/JSX/模板块保持原文不变。当前实现使用轻量状态扫描，不增加 Markdown AST 生产依赖，以控制 VS Code Web 扩展体积和运行时开销。

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

在数值与常见单位之间插入空格。数值支持负号、小数、千分位和范围；范围整体视为一个数值，只在末端单位前加空格。例如存储、带宽、频率、电量、温度和 SI 单位等。

| 输入 | 输出 |
|------|------|
| `宽带有10Gbps` | `宽带有 10 Gbps` |
| `SSD一共有20TB` | `SSD 一共有 20 TB` |
| `频率2.5GHz` | `频率 2.5 GHz` |
| `温度25°C` | `温度 25 °C` |
| `误差-10GB` | `误差 -10 GB` |
| `大小1,024KB` | `大小 1,024 KB` |
| `延迟10~20ms` / `10-20ms` | `延迟 10~20 ms` / `10-20 ms` |
| `吞吐量100MB/s` | `吞吐量 100 MB/s` |

**单位表（节选）**：`Gbps`、`Mbps`、`TB`/`GB`/`MB`/`KB`、`MB/s`、`m/s`、`GHz`/`MHz`/`kHz`/`Hz`、`ms`/`s`、`mAh`/`kWh`、`°C`/`°F`、`mm`/`cm`/`km`/`μm`、`Pa`/`kPa`、`J`/`kJ`、`V`、`W`、`Ω`、`ppm`，以及 `公斤`、`公里`、`升`、`分钟` 等中文常用单位；未列入的单位可通过配置扩展。

**边界约定**：`°C`/`°F` 是温度单位，规范化为 `25 °C`；裸角度 `25°` 仍由 MAS008 保持紧凑。`4K`、`1080p` 等习惯连写、版本号（如 `v3.6.0`）、产品型号（如 `Python3`）和路径（如 `release/v3.0`）不会误拆。复合单位只在数字与整体单位之间加空格，不会把 `/` 两侧拆开。

可通过 `markdownAutoSpace.units` 扩展单位，而无需复制默认列表。复合单位（如 `kg·m/s²`、`N·m`）按整体匹配，中文和领域单位也可直接加入：

```json
{
  "markdownAutoSpace.units": {
    "additional": ["rpm", "kWh", "μm"],
    "exclude": ["V"],
    "caseSensitive": true,
    "protectedModels": ["Python3", "X100"]
  }
}
```

`additional` 和 `include` 中的单位会合并追加，`exclude` 会从默认及追加列表中移除单位。`caseSensitive` 默认为 `true`；设为 `false` 后单位匹配不区分 ASCII 字母大小写。`protectedModels` 用于明确列出不应拆分的产品型号。非法、空白和重复值会忽略；单位会转义后再构造并缓存正则。配置同时影响正文和超链接文本的格式化及 MAS007 诊断。图片说明、行内代码和链接地址仍受保护。

配置键：`markdownAutoSpace.rules.MAS007`，默认 `true`。

**配置文件评估**：当前单位表扩展、大小写策略和型号保护名单均属于 MAS007 的轻量选项，且需要随 VS Code 工作区配置即时刷新，因此暂不引入独立单位配置文件；继续使用 `markdownAutoSpace.units` 可复用现有的用户/工作区/语言覆盖机制。只有当单位词条需要大规模共享、版本化或按领域分发时，才考虑拆分外部词典。

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

## 文件范围

`markdownAutoSpace.fileExtensions` 控制扩展处理哪些文件后缀，默认只有 `.md`。`.txt` 也受支持，但需要显式加入配置；后缀可带或不带开头的点号，扩展会自动规范化，并按大小写不敏感方式匹配。例如需要处理纯文本、MDX、Quarto 和 R Markdown 时可配置为：

```json
{
  "markdownAutoSpace.fileExtensions": [".md", ".txt", ".mdx", ".qmd", ".rmd"]
}
```

文件名匹配不依赖 VS Code 的语言模式，因此 `.mdx`、`.qmd`、`.rmd` 或 `.txt` 文件即使被识别为纯文本也会参与处理。修改配置会立即更新 provider、命令菜单和已打开文档的诊断；设为 `[]` 可禁用所有后缀。

各后缀共用 Markdown 规则及保护逻辑。MDX 中的 JSX 标签属性、普通 `{...}` 表达式、跨行表达式、字符串、注释、正则以及 `import` / `export` 语句都会被保护；表达式和代码中的中文混排标识符不会被空格规则改写。表达式前后的正文仍会继续格式化。

## 排除文件

`markdownAutoSpace.exclude` 接受 VS Code glob 数组。匹配的文档会完全跳过：手动保存格式化、扩展命令、标准 Format Document 提供器和诊断都不会处理它们。

```json
{
  "markdownAutoSpace.exclude": [
    "**/CHANGELOG.md",
    "**/generated/**"
  ]
}
```

工作区内的模式相对文件所属的工作区根目录匹配；多根工作区中的每个根分别计算。工作区外的文档按完整文档路径匹配。VS Code Web 中的虚拟工作区也使用所属工作区根作为基准；不属于工作区的非文件 URI 仅在其 URI 路径被模式匹配时排除。
