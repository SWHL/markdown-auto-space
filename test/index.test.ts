import { describe, expect, it, vi } from 'vitest'
import { Range } from 'vscode'
import {
  applyDigitUnitSpace,
  applyNoSpaceAroundCjkPunct,
  applyTightDegreePercent,
  getLineViolations,
  getMarkdownSpaceViolations,
  getSkippedLineIndices,
  processMarkdownContent,
  shouldSkipLine,
} from '../src/markdownSpace'
import { DEFAULT_MARKDOWN_SPACE_RULES, MANUAL_SAVE_REASON, RULES_DOC_BASE_URL, getRuleDocUrl, normalizeRules, shouldRunFormatOnSave } from '../src/type'
import type { MarkdownSpaceRulesType } from '../src/type'
import { getMarkdownAutoSpaceConfig, getMarkdownAutoSpaceEdits, getMarkdownAutoSpaceEditsForRange } from '../src/utils'

vi.mock('vscode', () => {
  class Range {
    start: { line: number, character: number }
    end: { line: number, character: number }

    constructor(start: { line: number, character: number }, end: { line: number, character: number }) {
      this.start = start
      this.end = end
    }
  }

  class TextEdit {
    range: Range
    newText: string

    constructor(range: Range, newText: string) {
      this.range = range
      this.newText = newText
    }

    static replace(range: Range, newText: string) {
      return new TextEdit(range, newText)
    }
  }

  return {
    Diagnostic: class {},
    DiagnosticSeverity: { Information: 1 },
    Range,
    TextEdit,
    Uri: { parse: (value: string) => value },
    window: { activeTextEditor: undefined },
    workspace: {
      getConfiguration: () => ({
        get: (key: string) => {
          if (key === 'formatOnSave')
            return true
          if (key === 'formatOnDocument')
            return false
          if (key === 'rules')
            return undefined
          if (key === 'diagnostics.enable')
            return true
          return undefined
        },
      }),
    },
  }
})

/** 单条用例: [用例描述, 输入, 期望输出]（描述放首位便于 it.each 显示测试名） */
type CaseRow = [description: string, input: string, expected: string]

/** 创建兼容 Range 构造的测试位置对象。 */
function createPosition(line: number, character: number) {
  return { line, character } as never
}

/** 构造最小化的 TextDocument mock，供 utils 层单测使用。 */
function createMockDocument(text: string, languageId = 'markdown') {
  const lines = text.split('\n')
  const lineOffsets: number[] = []
  let offset = 0
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }

  return {
    languageId,
    lineCount: lines.length,
    getText(range?: { start: { line: number, character: number }, end: { line: number, character: number } }) {
      if (!range)
        return text
      const startOffset = lineOffsets[range.start.line]! + range.start.character
      const endOffset = lineOffsets[range.end.line]! + range.end.character
      return text.slice(startOffset, endOffset)
    },
    lineAt(line: number) {
      const lineText = lines[line]!
      return {
        text: lineText,
        range: {
          start: { line, character: 0 },
          end: { line, character: lineText.length },
        },
      }
    },
    positionAt(offset: number) {
      let line = 0
      while (line + 1 < lineOffsets.length && lineOffsets[line + 1]! <= offset)
        line += 1
      return { line, character: offset - lineOffsets[line]! }
    },
  } as Parameters<typeof getMarkdownAutoSpaceEdits>[0]
}

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
  ['链接[]内中英文混排英文左右加空格', '[配置自动移除未使用的import](https://stackoverflow.com/questions/53352135/is-there-a-way-to-remove-unused-imports-for-python-in-vs-code)', '[配置自动移除未使用的 import](https://stackoverflow.com/questions/53352135/is-there-a-way-to-remove-unused-imports-for-python-in-vs-code)'],
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

/** 占位符字面量：文档中含 __PROTECTED_数字__ 且索引越界时不应报错，原样保留（修复 restoreOnePass 中 item 为 undefined 导致 .match 报错） */
const LITERAL_PLACEHOLDER_CASES: CaseRow[] = [
  ['字面量 __PROTECTED_99__ 索引越界时原样保留不报错', '文档中含__PROTECTED_99__字面量时不应报错', '文档中含 __PROTECTED_99__ 字面量时不应报错'],
]

/** MAS007–MAS009：对齐中文文案排版指北空格小节 */
const ZHIBEI_SPACE_CASES: CaseRow[] = [
  ['MAS007 数字与单位 Gbps', '我家的光纤入户宽带有10Gbps', '我家的光纤入户宽带有 10 Gbps'],
  ['MAS007 数字与单位 TB', 'SSD一共有20TB容量', 'SSD 一共有 20 TB 容量'],
  ['MAS007 小数与单位', '主频2.5GHz够用', '主频 2.5 GHz 够用'],
  ['MAS008 百分号紧凑', '新MacBook有15 %的CPU提升', '新 MacBook 有 15% 的 CPU 提升'],
  ['MAS008 度数紧凑', '角度为90 °的角', '角度为 90° 的角'],
  ['MAS009 逗号前空格', '买了iPhone ，好开心', '买了 iPhone，好开心'],
  ['MAS009 逗号后空格', '今天出去， 很开心', '今天出去，很开心'],
  ['MAS009 与链接文本内 MAS007', '[网速10Gbps说明](https://example.com)', '[网速 10 Gbps 说明](https://example.com)'],
]

/** 合并为全部用例（用于统一 it.each） */
const ALL_CASES: CaseRow[] = [...TEST_MDSPACING_CASES, ...PROCESS_MARKDOWN_CASES, ...LITERAL_PLACEHOLDER_CASES, ...ZHIBEI_SPACE_CASES]

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('processMarkdownContent', () => {
  it.each(ALL_CASES)('%s', (_description, input, expected) => {
    expect(processMarkdownContent(input)).toBe(expected)
  })
})

describe('normalizeRules', () => {
  it('无配置时返回默认规则', () => {
    expect(normalizeRules(undefined)).toEqual(DEFAULT_MARKDOWN_SPACE_RULES)
  })

  it('MAS007–MAS009 配置映射', () => {
    expect(normalizeRules({ MAS007: false }).digitUnitSpace).toBe(false)
    expect(normalizeRules({ MAS008: false }).tightDegreePercent).toBe(false)
    expect(normalizeRules({ MAS009: false }).noSpaceAroundCjkPunct).toBe(false)
  })

  it('MAS005: false 映射为 slashSpace: false', () => {
    const rules = normalizeRules({ MAS005: false })
    expect(rules.slashSpace).toBe(false)
    expect(rules.chineseAlnum).toBe(true)
  })

  it('MAS001: false 映射为 chineseAlnum: false', () => {
    const rules = normalizeRules({ MAS001: false })
    expect(rules.chineseAlnum).toBe(false)
    expect(rules.slashSpace).toBe(true)
  })

  it('多条规则可同时关闭', () => {
    const rules = normalizeRules({ MAS001: false, MAS004: false, MAS005: false, MAS006: false })
    expect(rules.chineseAlnum).toBe(false)
    expect(rules.dunhaoToComma).toBe(false)
    expect(rules.slashSpace).toBe(false)
    expect(rules.chineseLinkText).toBe(false)
    expect(rules.chineseBacktick).toBe(true)
    expect(rules.chineseLinkUrl).toBe(true)
  })

  it('未知键名不参与合并', () => {
    const rules = normalizeRules({ unknownKey: false, MAS005: false })
    expect(rules.slashSpace).toBe(false)
    expect((rules as unknown as Record<string, unknown>).unknownKey).toBeUndefined()
  })
})

describe('processMarkdownContent with custom rules', () => {
  it('MAS005 关闭时斜杠两侧不加空格', () => {
    const rules = { ...DEFAULT_MARKDOWN_SPACE_RULES, slashSpace: false }
    expect(processMarkdownContent('构建/工具等', rules)).toBe('构建/工具等')
  })

  it('MAS001 关闭时中英文之间不加空格', () => {
    const rules = { ...DEFAULT_MARKDOWN_SPACE_RULES, chineseAlnum: false }
    expect(processMarkdownContent('中文English混排', rules)).toBe('中文English混排')
  })

  it('MAS004 关闭时顿号不改为逗号', () => {
    const rules = { ...DEFAULT_MARKDOWN_SPACE_RULES, dunhaoToComma: false }
    expect(processMarkdownContent('支持Python、Java、C++', rules)).toBe('支持 Python、Java、C++')
  })

  it('MAS006 关闭时链接 [] 内中英文不加空格', () => {
    const rules = { ...DEFAULT_MARKDOWN_SPACE_RULES, chineseLinkText: false }
    expect(processMarkdownContent('[配置自动移除未使用的import](https://example.com)', rules))
      .toBe('[配置自动移除未使用的import](https://example.com)')
  })

  it('MAS007 关闭时不插入数字与单位间空格', () => {
    const rules: MarkdownSpaceRulesType = { ...DEFAULT_MARKDOWN_SPACE_RULES, digitUnitSpace: false }
    expect(processMarkdownContent('宽带有10Gbps', rules)).toBe('宽带有 10Gbps')
  })

  it('MAS008 关闭时保留百分号前空格', () => {
    const rules: MarkdownSpaceRulesType = { ...DEFAULT_MARKDOWN_SPACE_RULES, tightDegreePercent: false }
    expect(processMarkdownContent('有15 %提升', rules)).toBe('有 15 % 提升')
  })

  it('MAS009 关闭时保留全形逗号旁空格', () => {
    const rules: MarkdownSpaceRulesType = { ...DEFAULT_MARKDOWN_SPACE_RULES, noSpaceAroundCjkPunct: false }
    expect(processMarkdownContent('买了iPhone ，好', rules)).toBe('买了 iPhone ，好')
  })
})

describe('shouldRunFormatOnSave', () => {
  it('仅手动保存（Manual=1）时返回 true', () => {
    expect(shouldRunFormatOnSave(MANUAL_SAVE_REASON)).toBe(true)
    expect(shouldRunFormatOnSave(1)).toBe(true)
  })

  it('自动保存（AfterDelay=2）时返回 false', () => {
    expect(shouldRunFormatOnSave(2)).toBe(false)
  })

  it('失焦保存（FocusOut=3）时返回 false', () => {
    expect(shouldRunFormatOnSave(3)).toBe(false)
  })

  it('其他 reason 返回 false', () => {
    expect(shouldRunFormatOnSave(0)).toBe(false)
    expect(shouldRunFormatOnSave(4)).toBe(false)
  })
})

describe('getRuleDocUrl', () => {
  it('返回规则说明文档 base URL + 小写规则码锚点', () => {
    expect(getRuleDocUrl('MAS001')).toBe(`${RULES_DOC_BASE_URL}#mas001`)
    expect(getRuleDocUrl('MAS005')).toBe(`${RULES_DOC_BASE_URL}#mas005`)
  })

  it('规则码转为小写作为锚点', () => {
    expect(getRuleDocUrl('MAS002')).toContain('#mas002')
    expect(getRuleDocUrl('MAS002')).toBe(RULES_DOC_BASE_URL + '#mas002')
  })

  it('MAS006 锚点为 mas006', () => {
    expect(getRuleDocUrl('MAS006')).toBe(`${RULES_DOC_BASE_URL}#mas006`)
  })

  it('MAS007–MAS009 锚点', () => {
    expect(getRuleDocUrl('MAS007')).toBe(`${RULES_DOC_BASE_URL}#mas007`)
    expect(getRuleDocUrl('MAS009')).toBe(`${RULES_DOC_BASE_URL}#mas009`)
  })

  it('RULES_DOC_BASE_URL 指向仓库 docs/RULES.md', () => {
    expect(RULES_DOC_BASE_URL).toBe('https://github.com/SWHL/markdown-auto-space/blob/HEAD/docs/RULES.md')
  })
})

describe('applyDigitUnitSpace', () => {
  it('数字与 Gbps/TB 等单位之间插入空格', () => {
    expect(applyDigitUnitSpace('有10Gbps和20TB')).toBe('有10 Gbps和20 TB')
  })
  it('已有空格则不再插入', () => {
    expect(applyDigitUnitSpace('带宽 10 Gbps')).toBe('带宽 10 Gbps')
  })
  it('字母紧贴数字不拆（如 Python3）', () => {
    expect(applyDigitUnitSpace('Python3与10Gbps')).toBe('Python3与10 Gbps')
  })
})

describe('applyTightDegreePercent', () => {
  it('去掉数字与 ° % 间空格并保证 % 后接中文有空格', () => {
    expect(applyTightDegreePercent('15 %的')).toBe('15% 的')
    expect(applyTightDegreePercent('90 °的角')).toBe('90° 的角')
  })
  it('全角％同样处理', () => {
    expect(applyTightDegreePercent('50 ％完成')).toBe('50％ 完成')
  })
})

describe('applyNoSpaceAroundCjkPunct', () => {
  it('全形逗号两侧去空格', () => {
    expect(applyNoSpaceAroundCjkPunct('a ，b')).toBe('a，b')
    expect(applyNoSpaceAroundCjkPunct('好， 耶')).toBe('好，耶')
  })
  it('不在【前删空格', () => {
    expect(applyNoSpaceAroundCjkPunct('log 【注】')).toBe('log 【注】')
  })
})

describe('getLineViolations', () => {
  const allOn = DEFAULT_MARKDOWN_SPACE_RULES

  it('MAS007：数字与单位粘连时报违规', () => {
    const v = getLineViolations('正文10Gbps结束', allOn)
    expect(v.some(x => x.code === 'MAS007')).toBe(true)
  })
  it('MAS008：数字与 % 间有空格时报违规', () => {
    const v = getLineViolations('增长15 %的', allOn)
    expect(v.some(x => x.code === 'MAS008')).toBe(true)
  })
  it('MAS009：全形逗号前有空格时报违规', () => {
    const v = getLineViolations('买了iPhone ，好', allOn)
    expect(v.some(x => x.code === 'MAS009')).toBe(true)
  })
  it('行内代码内 10Gbps 不报 MAS007', () => {
    const v = getLineViolations('使用`10Gbps`测试', allOn)
    expect(v.filter(x => x.code === 'MAS007')).toHaveLength(0)
  })
  it('关闭 MAS007 时不报 MAS007', () => {
    const v = getLineViolations('正文10Gbps', { ...allOn, digitUnitSpace: false })
    expect(v.filter(x => x.code === 'MAS007')).toHaveLength(0)
  })
  it('空行无违规', () => {
    expect(getLineViolations('', allOn)).toHaveLength(0)
  })
})

describe('getMarkdownSpaceViolations', () => {
  it('多行分别收集行号', () => {
    const content = '第一行10Gbps\n普通行\n第三行15 %的'
    const v = getMarkdownSpaceViolations(content, DEFAULT_MARKDOWN_SPACE_RULES)
    const lines = new Set(v.map(x => x.lineIndex))
    expect(lines.has(0)).toBe(true)
    expect(lines.has(2)).toBe(true)
  })
  it('围栏代码块内不扫描', () => {
    const content = '```\n10Gbps\n```\n正文10Gbps'
    const v = getMarkdownSpaceViolations(content, DEFAULT_MARKDOWN_SPACE_RULES)
    const mas007 = v.filter(x => x.code === 'MAS007')
    expect(mas007.every(x => x.lineIndex === 3)).toBe(true)
  })
})

describe('shouldSkipLine', () => {
  it('YAML 分隔线与围栏行视为跳过（由 processMarkdownContent 处理）', () => {
    expect(shouldSkipLine('---')).toBe(true)
    expect(shouldSkipLine('```ts')).toBe(true)
  })
})

describe('getSkippedLineIndices', () => {
  it('统一识别 YAML、围栏代码块和缩进代码块', () => {
    const skipped = getSkippedLineIndices('---\ntitle: 测试\n---\n```ts\n中文English\n```\n    中文English\n正文English')
    expect([...skipped]).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe('DEFAULT_MARKDOWN_SPACE_RULES', () => {
  it('包含 MAS001–MAS009 对应键且默认开启', () => {
    expect(DEFAULT_MARKDOWN_SPACE_RULES).toMatchObject({
      chineseAlnum: true,
      digitUnitSpace: true,
      tightDegreePercent: true,
      noSpaceAroundCjkPunct: true,
    })
  })
})

describe('processMarkdownContent 组合规则', () => {
  it('MAS006 关闭时链接文本仍应用 MAS007', () => {
    const rules: MarkdownSpaceRulesType = {
      ...DEFAULT_MARKDOWN_SPACE_RULES,
      chineseLinkText: false,
    }
    expect(processMarkdownContent('[速率10Gbps](https://x.com)', rules))
      .toBe('[速率10 Gbps](https://x.com)')
  })
  it('同时关闭 MAS007 MAS008 MAS009', () => {
    const rules: MarkdownSpaceRulesType = {
      ...DEFAULT_MARKDOWN_SPACE_RULES,
      digitUnitSpace: false,
      tightDegreePercent: false,
      noSpaceAroundCjkPunct: false,
    }
    expect(processMarkdownContent('10Gbps， 15 %', rules)).toBe('10Gbps， 15 %')
  })
})

describe('getMarkdownAutoSpaceEdits', () => {
  it('文本无变化时不返回 edit', () => {
    const document = createMockDocument('已经有 空格')
    expect(getMarkdownAutoSpaceEdits(document, '已经有 空格')).toBeUndefined()
  })

  it('文本有变化时返回整篇替换 edit', () => {
    const document = createMockDocument('中文English')
    const edits = getMarkdownAutoSpaceEdits(document, '中文English')
    expect(edits).toHaveLength(1)
    expect(edits?.[0]?.newText).toBe('中文 English')
  })

  it('非 Markdown 文档不返回 edit', () => {
    const document = createMockDocument('中文English', 'plaintext')
    expect(getMarkdownAutoSpaceEdits(document, '中文English')).toBeUndefined()
  })
})

describe('getMarkdownAutoSpaceEditsForRange', () => {
  it('选区跨围栏代码块时跳过代码块内容，仅处理正文', () => {
    const text = '```ts\n中文English\n```\n正文English'
    const document = createMockDocument(text)
    const range = new Range(createPosition(0, 0), createPosition(3, 9))
    const edits = getMarkdownAutoSpaceEditsForRange(document, range)
    expect(edits).toHaveLength(1)
    expect(edits?.[0]?.newText).toBe('```ts\n中文English\n```\n正文 English')
  })

  it('选区位于 YAML front matter 中时不返回 edit', () => {
    const text = '---\ntitle: 中文English\n---\n正文'
    const document = createMockDocument(text)
    const range = new Range(createPosition(0, 0), createPosition(2, 3))
    expect(getMarkdownAutoSpaceEditsForRange(document, range)).toBeUndefined()
  })
})

describe('getMarkdownAutoSpaceConfig', () => {
  it('返回格式化文档开关，供标准 formatting provider 使用', () => {
    const config = getMarkdownAutoSpaceConfig()
    expect(config.formatOnDocument).toBe(false)
    expect(config.formatOnSave).toBe(true)
    expect('spaceType' in config).toBe(false)
  })
})
