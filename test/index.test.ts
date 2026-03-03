import { describe, expect, it } from 'vitest'
import { processMarkdownContent } from '../src/markdownSpace'

/** 单条用例: [用例描述, 输入, 期望输出]（描述放首位便于 it.each 显示测试名） */
type CaseRow = [description: string, input: string, expected: string]

// ---------------------------------------------------------------------------
// 所有测试用例（统一放在文件开头）
// ---------------------------------------------------------------------------

/** 来自 test_mdspacing.py 的用例 */
const TEST_MDSPACING_CASES: CaseRow[] = [
  ['中英文之间添加空格', 'RapidOCR是一款开源OCR工具', 'RapidOCR 是一款开源 OCR 工具'],
  ['字母数字组合后跟中文', 'Python3以上版本', 'Python3 以上版本'],
  ['反引号包裹的代码', '使用`rapidocr`库', '使用 `rapidocr` 库'],
  ['已有空格的不重复添加', '已经有 空格 的文本', '已经有 空格 的文本'],
  ['版本号不拆开', '版本v3.6.0更新', '版本 v3.6.0 更新'],
  ['英文逗号分隔', '支持Python,Java和C++语言', '支持 Python,Java 和 C++ 语言'],
  ['数字两侧加空格', '价格100元', '价格 100 元'],
  ['句号前不加空格', 'RapidOCR。这是句号', 'RapidOCR。这是句号'],
  ['括号内的英文', '测试(test)内容', '测试 (test) 内容'],
  ['英文间顿号改为逗号', '支持Python、Java、C++', '支持 Python, Java, C++'],
  ['反引号后跟中文', '`code`块测试', '`code` 块测试'],
  ['中文后跟反引号', '测试`code`块', '测试 `code` 块'],
  ['反引号内斜杠不加空格', '使用`release/v3.0`库', '使用 `release/v3.0` 库'],
  ['反引号内路径不加空格', '见`path/to/file`说明', '见 `path/to/file` 说明'],
  ['小数版本号', '版本3.14.159发布', '版本 3.14.159 发布'],
  ['紧凑的版本号', 'RapidOCRv3版本', 'RapidOCRv3 版本'],
  ['年份', '在2024年发布', '在 2024 年发布'],
  ['百分号', '超过90%的准确率', '超过 90% 的准确率'],
  ['C++语言', '使用C++开发', '使用 C++ 开发'],
  ['带点号的版本', 'Python3.6以上', 'Python3.6 以上'],
  ['多个语言用顿号', '支持C++、Java、Python语言', '支持 C++, Java, Python 语言'],
  ['URL左侧加空格', '访问https://github.com/RapidAI/RapidOCR项目', '访问 https://github.com/RapidAI/RapidOCR 项目'],
  ['Markdown链接文本加空格', '查看[RapidOCR文档](https://rapidai.github.io/RapidOCRDocs)', '查看 [RapidOCR 文档](https://rapidai.github.io/RapidOCRDocs)'],
  ['URL左右都要加空格', '网址http://example.com/test后续内容', '网址 http://example.com/test 后续内容'],
  ['URL左右都加空格', '项目地址https://github.com/RapidAI/RapidOCR欢迎访问', '项目地址 https://github.com/RapidAI/RapidOCR 欢迎访问'],
  ['粗体左右加空格', '这是**重要内容**说明', '这是 **重要内容** 说明'],
  ['粗体内英文两侧加空格', '使用**RapidOCR**工具', '使用 **RapidOCR** 工具'],
  ['粗体内版本号两侧加空格', '版本**v3.6.0**更新', '版本 **v3.6.0** 更新'],
  ['反引号内粗体语法不替换为占位符', '4. **粗体标记** `**text**` - 整体保护', '4. **粗体标记** `**text**` - 整体保护'],
  ['斜杠左右加空格', '构建/工具等', '构建 / 工具等'],
  ['英文斜杠两侧均为英文不加空格', 'CPU/GPU切换', 'CPU/GPU 切换'],
  ['中文斜杠加空格', '前端/后端开发', '前端 / 后端开发'],
  ['英文斜杠后跟中文仅右侧加空格', 'Python/Java语言', 'Python/Java 语言'],
  ['字母斜杠两侧英文不加空格', '测试A/B方案', '测试 A/B 方案'],
  ['release 分支名不加空格', '切换到release/v3.0分支', '切换到 release/v3.0 分支'],
  ['HTML 闭合标签', '</div>', '</div>'],
  ['HTML 链接闭合标签', '</a>', '</a>'],
  ['HTML 开始标签', '<div>', '<div>'],
  ['HTML 带属性标签', '<a href="test">', '<a href="test">'],
  ['HTML 标签后跟中文', '</div>这是文本', '</div> 这是文本'],
  ['中文后跟 HTML 标签', '文本</div>', '文本 </div>'],
  ['HTML 自闭合标签', '<img src="test.png">', '<img src="test.png">'],
  ['HTML 标签内包含 URL', '<a href="https://example.com">链接</a>', '<a href="https://example.com"> 链接 </a>'],
]

/** 中英文、多行、引号/括号、代码、Markdown 等用例 */
const PROCESS_MARKDOWN_CASES: CaseRow[] = [
  ['中英文 1', ' 你好Hello World，这是一个test', ' 你好 Hello World，这是一个 test'],
  ['中英文 2', ' 你好Hello World这也是一个test', ' 你好 Hello World 这也是一个 test'],
  ['多行 1', ' 你好Hello World，这是一个test\n 你好Hello World，这是一个test', ' 你好 Hello World，这是一个 test\n 你好 Hello World，这是一个 test'],
  ['多行 2', ' 你好Hello World，这是一个test\n 你好Hello World，这是一个test\n 你好Hello World，这是一个test', ' 你好 Hello World，这是一个 test\n 你好 Hello World，这是一个 test\n 你好 Hello World，这是一个 test'],
  ['EN_PUNCT 引号内不处理', 'console.log("中文测试")', 'console.log("中文测试")'],
  ['EN_PUNCT 引号内中英不处理', 'console.log("EN_PUNCT中文测试")', 'console.log("EN_PUNCT中文测试")'],
  ['EN_PUNCT 花括号引号内不处理', 'console.log{"EN_PUNCT中文测试"}', 'console.log{"EN_PUNCT中文测试"}'],
  ['EN_PUNCT 方括号引号内不处理', 'console.log["EN_PUNCT中文测试"]', 'console.log["EN_PUNCT中文测试"]'],
  ['中文与英文括号', '中文测试(EN_PUNCT)', '中文测试 (EN_PUNCT)'],
  ['中文+console 双引号内不处理', '中文测试console.log("EN_PUNCT中文测试")', '中文测试 console.log("EN_PUNCT中文测试")'],
  ['中文+console 花括号引号内不处理', '中文测试console.log{"EN_PUNCT中文测试"}', '中文测试 console.log{"EN_PUNCT中文测试"}'],
  ['中文+console 方括号引号内不处理', '中文测试console.log["EN_PUNCT中文测试"]', '中文测试 console.log["EN_PUNCT中文测试"]'],
  ['全角括号内英文', '中文测试（中文English）', '中文测试（中文 English）'],
  ['全角括号+引号内不处理', '中文测试console.log（"中文English中文测试"）', '中文测试 console.log（"中文English中文测试"）'],
  ['方括号+引号内不处理', '中文测试console.log【"中文English中文测试"】', '中文测试 console.log【"中文English中文测试"】'],
  ['直角引号内双引号不处理', '中文测试console.log「"中文English中文测试"」', '中文测试 console.log「"中文English中文测试"」'],
  ['空格+方括号引号内不处理', '中文测试console.log 【"中文English中文测试"】', '中文测试 console.log 【"中文English中文测试"】'],
  ['exec 后中文', 'exec() 你好()', 'exec() 你好 ()'],
  ['引号内中文不拆', 'new IllegalArgumentException("非法下标参数")', 'new IllegalArgumentException("非法下标参数")'],
  ['map 结果是', 'target = 18, int[] nums = [1, 5, 7, 11], 循环三次的map结果是{1 = 0, 5 = 1, 7 = 2 }', 'target = 18, int[] nums = [1, 5, 7, 11], 循环三次的 map 结果是{1 = 0, 5 = 1, 7 = 2 }'],
  ['TS 类型', 'const a: number = 1, const b: string = "123"', 'const a: number = 1, const b: string = "123"'],
  ['TS 泛型', 'type A<T> = { a: T, b: T }; const a = [1, 2, 3]', 'type A<T> = { a: T, b: T }; const a = [1, 2, 3]'],
  ['对象字面量', 'const a = { a: "1", b: 3 }', 'const a = { a: "1", b: 3 }'],
  ['## 与中文不加空格', '##测试Heading level 1', '##测试 Heading level 1'],
  ['Markdown 链接', '更多的更新日志请查看[CHANGELOG](./CHANGELOG.md)', '更多的更新日志请查看 [CHANGELOG](./CHANGELOG.md)'],
  ['emoji 后不加空格', '编辑markdown文件时，## 🌸Thanks', '编辑 markdown 文件时，## 🌸Thanks'],
  ['图片语法整体保护', '![展示图片](/public/show-select.png)', '![展示图片](/public/show-select.png)'],
  ['图片语法空 alt URL 内斜杠不加空格', '见图![](../../images/vis_det_cls_rec.jpg)说明', '见图 ![](../../images/vis_det_cls_rec.jpg) 说明'],
  ['© 符号不加空格', 'test©2023', 'test©2023'],
  ['引用块 ####', '> ####测试The quarterly results look great!', '> ####测试 The quarterly results look great!'],
  ['列表 * 后中文', '*测试', '* 测试'],
  ['列表 + 后中文', '+测试', '+ 测试'],
  ['``` 行跳过不处理', '```代码code```', '```代码code```'],
  ['缩进代码块行不处理', '普通行\n    const a = "中文"\n后续', '普通行\n    const a = "中文"\n后续'],
  ['tab 缩进代码行不处理', '文本\n\tprint("hello世界")', '文本\n\tprint("hello世界")'],
  ['链接+title 引号内不处理', '这是一个链接[Markdown语法](https://markdown.com.cn "最好的markdown教程")。', '这是一个链接 [Markdown 语法](https://markdown.com.cn "最好的markdown教程")。'],
]

/** 合并为全部用例（用于统一 it.each） */
const ALL_CASES: CaseRow[] = [...TEST_MDSPACING_CASES, ...PROCESS_MARKDOWN_CASES]

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('processMarkdownContent', () => {
  it.each(ALL_CASES)('%s', (_description, input, expected) => {
    expect(processMarkdownContent(input)).toBe(expected)
  })
})
