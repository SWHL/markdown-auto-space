import type { MarkdownSpaceRulesType } from './type'
import { protectMdxContent } from './mdx'

/**
 * Markdown 中文与英文/数字间加空格
 * 各规则可通过 settings 中 markdownAutoSpace.rules 单独开关
 */

const PROTECTED_PLACEHOLDER = '__PROTECTED_'

/** 数字与单位：按长度降序，避免复合单位被拆成短单位。 */
const DEFAULT_DIGIT_UNIT_SUFFIXES = [
  'Gbps', 'Mbps', 'Kbps', 'TiB', 'GiB', 'MiB', 'KiB', 'THz', 'GHz', 'MHz', 'kHz',
  'MB/s', 'GB/s', 'KB/s', 'Gb/s', 'm/s', 'km/h', 'mAh', 'kWh', 'Wh', 'kW', 'MW',
  '°C', '°F', 'dpi', 'bps', 'TB', 'GB', 'MB', 'KB', 'Hz', 'ms', 'ns', 'ps', 'px',
  'kPa', 'MPa', 'Pa', 'kJ', 'MJ', 'J', 'kcal', 'cal', 'kN', 'N', 'lm', 'lx', 'ppm', 'ppb',
  'μm', 'nm', 'mm', 'cm', 'km', 'm', 'mg', 'kg', 'g', 't', 'mL', 'dL', 'L', 'mol',
  'min', 'h', 's', 'rad', 'mΩ', 'Ω', 'A', 'V', 'W',
  '公里', '厘米', '毫米', '米', '公斤', '千克', '克', '吨', '升', '毫升', '秒', '分钟', '小时',
] as const

export interface DigitUnitOptions {
  additional?: unknown
  include?: unknown
  exclude?: unknown
}

const digitUnitRegexCache = new Map<string, RegExp>()
const digitUnitRegexObjectCache = new WeakMap<object, RegExp>()

function normalizeUnitValues(value: unknown): string[] {
  if (!Array.isArray(value))
    return []
  return [...new Set(value.filter((unit): unit is string => typeof unit === 'string')
    .map(unit => unit.trim())
    .filter(unit => unit.length > 0 && unit.length <= 32 && !/\s/u.test(unit)))]
}

function getDigitUnitRegex(options: DigitUnitOptions = {}): RegExp {
  const objectOptions = options as object
  const objectCached = digitUnitRegexObjectCache.get(objectOptions)
  if (objectCached)
    return objectCached
  const additional = normalizeUnitValues([
    ...normalizeUnitValues(options.additional),
    ...normalizeUnitValues(options.include),
  ])
  const excluded = new Set(normalizeUnitValues(options.exclude))
  const units = [...new Set([...DEFAULT_DIGIT_UNIT_SUFFIXES, ...additional])]
    .filter(unit => !excluded.has(unit))
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
  const key = units.join('\u0000')
  const cached = digitUnitRegexCache.get(key)
  if (cached) {
    digitUnitRegexObjectCache.set(objectOptions, cached)
    return cached
  }
  const escaped = units.map(unit => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  let regex = escaped.length === 0
    ? /(?!) /gu
    : new RegExp(`(?<![A-Za-z0-9_])(\\d+(?:\\.\\d+)?)(${escaped.join('|')})(?![A-Za-z0-9])`, 'gu')
  const slash = String.fromCharCode(92)
  const digit = `${slash}d`
  const number = `-?(?:(?:${digit}{1,3}(?:,${digit}{3})+)|${digit}+)(?:${slash}.${digit}+)?`
  regex = escaped.length === 0
    ? /(?!) /gu
    : new RegExp(`(?<![A-Za-z0-9_.,])(${number}(?:${slash}s*[~-]${slash}s*${number})?)(${escaped.join('|')})(?![A-Za-z0-9./])`, 'gu')
  digitUnitRegexCache.set(key, regex)
  digitUnitRegexObjectCache.set(objectOptions, regex)
  return regex
}

/**
 * 数字（可含负号、小数、千分位或范围）与单位之间加空格，不与字母数字粘连
 * @param text
 */
export function applyDigitUnitSpace(text: string, options: DigitUnitOptions = {}): string {
  return text.replace(getDigitUnitRegex(options), '$1 $2')
}

/**
 * 度数、百分号与数字之间去掉多余空格；°/% 与后续中文之间保留一个空格（指北：90° 的角、15% 的）
 * @param text
 */
export function applyTightDegreePercent(text: string): string {
  let result = text
  let prev = ''
  while (prev !== result) {
    prev = result
    result = result.replace(/(\d+)\s+(°(?![CF])|[%％])/g, '$1$2')
  }
  result = result.replace(/(°(?![CF])|[%％])(?=[\u4e00-\u9fff])/g, '$1 ')
  return result
}

/**
 * 全形标点两侧不留 ASCII 空格（指北：逗号、句号等与其他字符间不加空格）。
 * 不在【《「『（前删空格，避免英文与左引号/左括号之间可读性被破坏（如 console.log 【）。
 * @param text
 */
export function applyNoSpaceAroundCjkPunct(text: string): string {
  const noSpaceBefore = String.raw`，。！？；：、…」』】》）`
  const noSpaceAfter = String.raw`，。！？；：、…「」『』【《（`
  const noSpaceBeforeClose = String.raw`】》」』）`
  let result = text.replace(new RegExp(`\\s+([${noSpaceBefore}])`, 'gu'), '$1')
  result = result.replace(new RegExp(`([${noSpaceAfter}])\\s+`, 'gu'), '$1')
  result = result.replace(new RegExp(`\\s+([${noSpaceBeforeClose}])`, 'gu'), '$1')
  return result
}

/**
 *
 * @param linkText
 * @param options
 */
function applyLinkTextPostRules(linkText: string, options: MarkdownSpaceRulesType, units: DigitUnitOptions = {}): string {
  let lt = linkText
  if (options.digitUnitSpace)
    lt = applyDigitUnitSpace(lt, units)
  if (options.tightDegreePercent)
    lt = applyTightDegreePercent(lt)
  if (options.noSpaceAroundCjkPunct)
    lt = applyNoSpaceAroundCjkPunct(lt)
  if (options.chineseLinkText)
    lt = addSpacesInText(lt, true)
  return lt
}

const DEFAULT_RULES: MarkdownSpaceRulesType = {
  chineseAlnum: true,
  chineseBacktick: true,
  chineseLinkUrl: true,
  chineseLinkText: true,
  dunhaoToComma: true,
  slashSpace: true,
  digitUnitSpace: true,
  tightDegreePercent: true,
  noSpaceAroundCjkPunct: true,
}

/** 规则码与说明（用于诊断提示，类似 markdownlint 的 MDxxx） */
export const RULE_DIAGNOSTIC_MAP: Record<keyof MarkdownSpaceRulesType, { code: string, message: string, description: string, examples: [string, string][] }> = {
  chineseAlnum: { code: 'MAS001', message: '中英文/数字之间应有空格', description: '在中文与英文或数字之间补充空格。', examples: [['中文English', '中文 English'], ['价格100元', '价格 100 元']] },
  chineseBacktick: { code: 'MAS002', message: '中文与行内代码（反引号）之间应有空格', description: '在中文与行内代码之间补充空格。', examples: [['使用`code`库', '使用 `code` 库']] },
  chineseLinkUrl: { code: 'MAS003', message: '中文与链接/URL 之间应有空格', description: '在中文与链接或 URL 的边界补充空格。', examples: [['查看[文档](url)', '查看 [文档](url)']] },
  chineseLinkText: { code: 'MAS006', message: '超链接 [] 内中英文混排时英文左右应有空格', description: '在链接文本中的中文与英文或数字之间补充空格。', examples: [['[配置import](url)', '[配置 import](url)']] },
  dunhaoToComma: { code: 'MAS004', message: '英文/数字间的顿号应改为逗号+空格', description: '将英文或数字之间的顿号替换为逗号和空格。', examples: [['Python、Java', 'Python, Java']] },
  slashSpace: { code: 'MAS005', message: '斜杠与中文之间应有空格', description: '仅在斜杠邻近中文时补充空格。', examples: [['前端/后端', '前端 / 后端'], ['CPU/GPU', 'CPU/GPU']] },
  digitUnitSpace: { code: 'MAS007', message: '数字与单位之间应有空格', description: '在数字与常见单位之间补充空格。', examples: [['10Gbps', '10 Gbps']] },
  tightDegreePercent: { code: 'MAS008', message: '度数、百分号与数字之间不应有空格', description: '移除数字与度数或百分号之间多余的空格。', examples: [['15 %', '15%']] },
  noSpaceAroundCjkPunct: { code: 'MAS009', message: '全形标点旁不应有空格', description: '移除全形标点旁多余的 ASCII 空格。', examples: [['iPhone ，好', 'iPhone，好']] },
}

/**
 *
 * @param ranges
 */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0)
    return []
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  let cur = sorted[0]!
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i]!
    if (r[0] <= cur[1]) {
      cur = [cur[0], Math.max(cur[1], r[1])]
    }
    else {
      out.push(cur)
      cur = r
    }
  }
  out.push(cur)
  return out
}

/**
 *
 * @param line
 */
function collectProtectedRanges(line: string, protectLinks = true): [number, number][] {
  const patterns = [
    /\\[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g,
    /(`+)([\s\S]*?)\1/g,
    /!\[[^\]]*\]\([^)]+\)/g,
    ...(protectLinks ? [/\[([^\]]+)\]\(([^)]+)\)/g] : []),
    ...(protectLinks ? [/\[[^\]\n]+\]\s*\[[^\]\n]*\]/g] : []),
    /<(?:https?:\/\/|mailto:)[^>\n]+>/g,
    /<\/?[a-zA-Z][^>]*>/g,
    /<!--[\s\S]*?-->/g,
    /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g,
    /\$\{(?:[^{}]|\{[^{}]*\})*\}/g,
    /\{\{(?:[^{}]|\{[^{}]*\})*\}\}/g,
    /"[^"]*"/g,
    /'[^']*'/g,
    /\*\*[^*]+\*\*/g,
    /(`+)[\s\S]*$/g,
    /\[[^\]\n]*$/g,
    /(?:"[^"\n]*|(?<![A-Za-z])'[^'\n]*)$/g,
  ]
  const ranges: [number, number][] = []
  for (const re of patterns) {
    const r = new RegExp(re.source, 'g')
    let m: RegExpExecArray | null
    while ((m = r.exec(line)) !== null)
      ranges.push([m.index, m.index + m[0].length])
  }
  return mergeRanges(ranges)
}

/** Protect Markdown/MDX constructs whose closing delimiter may be absent. */
function protectUnclosedStructures(text: string, saveItem: (match: string, opaque?: boolean) => string): string {
  let result = text
  // Reference links and autolinks are complete constructs, but are not handled
  // by the inline-link matcher below.
  result = result.replace(/!?\[[^\]\n]+\]\s*\[[^\]\n]*\]/g, saveItem)
  result = result.replace(/<(?:https?:\/\/|mailto:)[^>\n]+>/g, saveItem)
  // MDX/JSX expressions are opaque to a prose formatter. A balanced expression
  // is protected first; an unterminated expression is protected to EOL.
  result = result.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, saveItem)
  result = result.replace(/\$\{[^{}]*$/g, saveItem)
  result = result.replace(/\{\{(?:[^{}]|\{[^{}]*\})*\}\}/g, saveItem)
  result = result.replace(/\{\{[^{}]*$/g, saveItem)
  // Be conservative with malformed inline constructs: changing their contents
  // is worse than leaving the remainder of the line untouched.
  result = result.replace(/(`+)[\s\S]*$/g, (full, marker: string) => {
    let count = 0
    let offset = 0
    while ((offset = full.indexOf(marker, offset)) >= 0) {
      count++
      offset += marker.length
    }
    return count >= 2 ? full : saveItem(full, true)
  })
  result = result.replace(/\[[^\]\n]*$/g, match => saveItem(match, true))
  result = result.replace(/(?:"[^"\n]*|(?<![A-Za-z])'[^'\n]*)$/g, match => saveItem(match, true))
  return result
}

function collectLinkTextRanges(line: string): [number, number][] {
  const ranges: [number, number][] = []
  const patterns = [/!?\[([^\]]+)\]\([^)]+\)/g, /!?\[([^\]]+)\]\s*\[[^\]]*\]/g]
  for (const re of patterns) {
    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      if (match[0].startsWith('!'))
        continue
      const start = match.index + 1
      ranges.push([start, start + match[1]!.length])
    }
  }
  return ranges
}

/**
 *
 * @param ranges
 * @param start
 * @param end
 */
function rangeOverlaps(ranges: [number, number][], start: number, end: number): boolean {
  return ranges.some(([a, b]) => start < b && end > a)
}

/**
 * 比较原始行与处理后行，找出「插入空格」的位置（在原始行中的起始下标，高亮两字符）
 * @param original
 * @param output
 */
function findInsertionRanges(original: string, output: string): number[] {
  const starts: number[] = []
  let i = 0
  let j = 0
  while (i < original.length && j < output.length) {
    if (original[i] === output[j]) {
      i++
      j++
      continue
    }
    if (output[j] === ' ' && original[i] !== ' ') {
      const start = i > 0 ? i - 1 : i
      starts.push(start)
      j++
      continue
    }
    i++
    j++
  }
  return starts
}

/**
 *
 */
function emptyRules(): MarkdownSpaceRulesType {
  return {
    chineseAlnum: false,
    chineseBacktick: false,
    chineseLinkUrl: false,
    chineseLinkText: false,
    dunhaoToComma: false,
    slashSpace: false,
    digitUnitSpace: false,
    tightDegreePercent: false,
    noSpaceAroundCjkPunct: false,
  }
}

/**
 * 对单行检测违反规则的位置，返回用于诊断的区间与规则信息（仅对当前启用的规则）
 * @param line
 * @param rules
 */
export function getLineViolations(
  line: string,
  rules: MarkdownSpaceRulesType,
  units: DigitUnitOptions = {},
): { start: number, length: number, ruleId: keyof MarkdownSpaceRulesType, code: string, message: string }[] {
  const violations: { start: number, length: number, ruleId: keyof MarkdownSpaceRulesType, code: string, message: string }[] = []
  const protectedRanges = collectProtectedRanges(line)
  const linkTextRanges = collectLinkTextRanges(line)
  const nonLinkProtectedRanges = collectProtectedRanges(line, false)
  const seenStarts = new Set<number>()

  const pushUnique = (start: number, length: number, ruleId: keyof MarkdownSpaceRulesType) => {
    if (seenStarts.has(start))
      return
    seenStarts.add(start)
    const meta = RULE_DIAGNOSTIC_MAP[ruleId]
    if (length <= 0 || start >= line.length)
      return
    violations.push({
      start,
      length: Math.min(length, line.length - start),
      ruleId,
      code: meta.code,
      message: meta.message,
    })
  }

  if (rules.digitUnitSpace) {
    let m: RegExpExecArray | null
    const digitUnitViolationRe = getDigitUnitRegex(units)
    digitUnitViolationRe.lastIndex = 0
    while ((m = digitUnitViolationRe.exec(line)) !== null) {
      const match = m
      const num = match[1]!
      const start = match.index + num.length
      const end = start + (match[2]!.length)
      const inLinkText = linkTextRanges.some(([start, finish]) => match.index >= start && end <= finish)
      if (!rangeOverlaps(nonLinkProtectedRanges, match.index, end)
        && (!rangeOverlaps(protectedRanges, match.index, end) || inLinkText))
        pushUnique(start > 0 ? start - 1 : start, Math.min(2, line.length - (start > 0 ? start - 1 : start)), 'digitUnitSpace')
    }
  }

  if (rules.tightDegreePercent) {
    const re = /(\d+)(\s+)(°(?![CF])|[%％])/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      const spStart = m.index + m[1]!.length
      const spEnd = spStart + m[2]!.length
      if (!rangeOverlaps(protectedRanges, spStart, spEnd))
        pushUnique(spStart, m[2]!.length, 'tightDegreePercent')
    }
  }

  if (rules.noSpaceAroundCjkPunct) {
    const noSpaceBefore = String.raw`，。！？；：、…」』】》）`
    const noSpaceAfter = String.raw`，。！？；：、…「」『』【《（`
    const noSpaceBeforeClose = String.raw`】》」』）`
    const beforePunct = new RegExp(`\\s+([${noSpaceBefore}])`, 'gu')
    let m: RegExpExecArray | null
    while ((m = beforePunct.exec(line)) !== null) {
      const spStart = m.index
      const spEnd = spStart + m[0].length - m[1]!.length
      if (!rangeOverlaps(protectedRanges, spStart, spEnd))
        pushUnique(spStart, spEnd - spStart, 'noSpaceAroundCjkPunct')
    }
    const afterPunct = new RegExp(`([${noSpaceAfter}])(\\s+)`, 'gu')
    while ((m = afterPunct.exec(line)) !== null) {
      const spStart = m.index + m[1]!.length
      const spEnd = spStart + m[2]!.length
      if (!rangeOverlaps(protectedRanges, spStart, spEnd))
        pushUnique(spStart, spEnd - spStart, 'noSpaceAroundCjkPunct')
    }
    const beforeClose = new RegExp(`\\s+([${noSpaceBeforeClose}])`, 'gu')
    while ((m = beforeClose.exec(line)) !== null) {
      const spStart = m.index
      const spEnd = spStart + m[0].length - m[1]!.length
      if (!rangeOverlaps(protectedRanges, spStart, spEnd))
        pushUnique(spStart, spEnd - spStart, 'noSpaceAroundCjkPunct')
    }
  }

  const insertionRuleIds: (keyof MarkdownSpaceRulesType)[] = [
    'chineseAlnum',
    'chineseBacktick',
    'chineseLinkUrl',
    'chineseLinkText',
    'dunhaoToComma',
    'slashSpace',
  ]

  for (const ruleId of insertionRuleIds) {
    if (!rules[ruleId])
      continue
    const only = emptyRules()
    only[ruleId] = true
    const output = addSpacesBetweenChineseAndAlnum(line, only)
    const starts = findInsertionRanges(line, output)
    const meta = RULE_DIAGNOSTIC_MAP[ruleId]
    for (const start of starts) {
      if (seenStarts.has(start))
        continue
      seenStarts.add(start)
      const length = Math.min(2, line.length - start)
      if (length <= 0)
        continue
      violations.push({
        start,
        length,
        ruleId,
        code: meta.code,
        message: meta.message,
      })
    }
  }

  return violations
}

/**
 * 在中文和数字/英文之间添加空格（单行处理）
 * 先保护 Markdown 链接、HTML 标签、URL、**粗体**，处理后再恢复
 * @param text
 * @param options 未传则全部规则启用（与旧行为一致）
 */
export function addSpacesBetweenChineseAndAlnum(
  text: string,
  options: MarkdownSpaceRulesType = DEFAULT_RULES,
  units: DigitUnitOptions = {},
): string {
  const protectedItems: string[] = []

  /**
   *
   * @param match
   */
  function saveItem(match: string, opaque = false): string {
    protectedItems.push(match)
    return opaque === true
      ? `__OPAQUE_${protectedItems.length - 1}__`
      : `${PROTECTED_PLACEHOLDER}${protectedItems.length - 1}__`
  }

  let result = text

  // Escaped punctuation is literal Markdown text and must not open another
  // construct (notably an escaped backtick or bracket).
  result = result.replace(/\\[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g, match => saveItem(match, true))

  // 1. 保护反引号包裹的 inline code（最高优先级，内部可为任意内容）
  result = result.replace(/(`+)([\s\S]*?)\1/g, saveItem)

  // 2. 保护 Markdown 图片语法
  result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, saveItem)

  // 3. 保护 Markdown 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, saveItem)

  // 4. 保护 HTML 标签
  result = result.replace(/<\/?[a-zA-Z][^>]*>/g, saveItem)

  // 5. 保护独立 URL
  result = result.replace(/https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g, saveItem)

  // 6. 保护引号中的内容
  result = result.replace(/"[^"]*"/g, saveItem)
  result = result.replace(/'[^']*'/g, saveItem)

  // 7. 保护 **粗体**
  result = result.replace(/\*\*[^*]+\*\*/g, saveItem)

  // 8. 保护引用式链接、自动链接、MDX/JSX 表达式及未闭合结构
  result = protectUnclosedStructures(result, saveItem)

  // Normalize block quote/list markers even when the source omitted the
  // optional Markdown whitespace. This is structural whitespace, not prose.
  result = result.replace(/^(\s*(?:(?:[-+*]|\d+[.)])\s*)?>)\s*(?=[\u4e00-\u9fff])/u, '$1 ')

  if (options.dunhaoToComma) {
    result = result.replace(
      /([a-zA-Z0-9`+\-*/=])、(?=[a-zA-Z0-9`])/g,
      '$1, ',
    )
  }

  if (options.slashSpace) {
    result = result.replace(
      /([\u4e00-\u9fff])(?! )(\/)/g,
      '$1 $2',
    )
    result = result.replace(
      /(\/)(?! )([\u4e00-\u9fff])/g,
      '$1 $2',
    )
  }

  if (options.chineseBacktick) {
    result = result.replace(
      /([\u4e00-\u9fff])(?! )(`)/g,
      '$1 $2',
    )
    result = result.replace(
      /(`)(?!`)(?! )([\u4e00-\u9fff])/g,
      '$1 $2',
    )
  }

  if (options.chineseLinkUrl) {
    result = result.replace(
      new RegExp(`([\\u4e00-\\u9fff])(?! )(${PROTECTED_PLACEHOLDER}\\d+__)`, 'g'),
      '$1 $2',
    )
    result = result.replace(
      new RegExp(`(${PROTECTED_PLACEHOLDER}\\d+__)(?! )([\\u4e00-\\u9fff])`, 'g'),
      '$1 $2',
    )
  }

  if (options.chineseAlnum) {
    result = result.replace(
      /([\u4e00-\u9fff])(?! )([a-zA-Z0-9(])/g,
      '$1 $2',
    )
    result = result.replace(
      /([a-zA-Z0-9)%+\-*=])(?! )(?![、,。;:!?》】)])([\u4e00-\u9fff])/g,
      '$1 $2',
    )
  }

  if (options.digitUnitSpace)
    result = applyDigitUnitSpace(result, units)

  if (options.tightDegreePercent)
    result = applyTightDegreePercent(result)

  if (options.noSpaceAroundCjkPunct)
    result = applyNoSpaceAroundCjkPunct(result)

  const placeholderRegex = new RegExp(`(?:${PROTECTED_PLACEHOLDER}|__OPAQUE_)(\\d+)__`, 'g')
  /**
   *
   * @param input
   */
  function restoreOnePass(input: string): string {
    return input.replace(placeholderRegex, (fullMatch, indexStr) => {
      const i = Number.parseInt(indexStr, 10)
      let item = protectedItems[i]
      if (item === undefined)
        return fullMatch
      const linkMatch = item.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      const referenceMatch = item.match(/^\[([^\]]+)\](\s*\[[^\]]*\])$/)
      if (linkMatch && !linkMatch[1].startsWith('!')) {
        const [, linkText, linkUrl] = linkMatch
        item = `[${applyLinkTextPostRules(linkText, options, units)}](${linkUrl})`
      }
      else if (referenceMatch && !referenceMatch[1].startsWith('!')) {
        item = `[${applyLinkTextPostRules(referenceMatch[1], options, units)}]${referenceMatch[2]}`
      }
      return item
    })
  }

  for (let pass = 0; pass <= protectedItems.length; pass += 1) {
    const restored = restoreOnePass(result)
    if (restored === result)
      break
    result = restored
  }

  return result
}

/**
 * 仅对纯文本做中英文间加空格（用于链接文本等，不保护 URL）
 * @param text
 * @param apply
 */
export function addSpacesInText(text: string, apply = true): string {
  if (!apply)
    return text
  let result = text
  result = result.replace(
    /([\u4e00-\u9fff])(?! )([a-zA-Z0-9])/g,
    '$1 $2',
  )
  result = result.replace(
    /([a-zA-Z0-9])(?! )(?![、,。;:!?》】)])([\u4e00-\u9fff])/g,
    '$1 $2',
  )
  return result
}

interface FencedCodeMarker {
  char: '`' | '~'
  length: number
}

/**
 * 识别最多 3 个空格缩进的围栏起始行。围栏后的内容作为语言标识等信息，
 * 不参与围栏长度判断；反引号围栏的 info string 不能再包含反引号。
 */
function parseFenceOpening(line: string): FencedCodeMarker | null {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line)
  if (!match)
    return null
  const marker = match[2]!
  if (marker[0] === '`' && match[3]!.includes('`'))
    return null
  return { char: marker[0] as '`' | '~', length: marker.length }
}

/** 识别围栏结束行；结束行只能包含围栏和空白。 */
function parseFenceClosing(line: string): FencedCodeMarker | null {
  const match = /^( {0,3})(`{3,}|~{3,})[ \t\r]*$/.exec(line)
  if (!match)
    return null
  const marker = match[2]!
  return { char: marker[0] as '`' | '~', length: marker.length }
}

function closesFence(line: string, opening: FencedCodeMarker): boolean {
  const closing = parseFenceClosing(line)
  return closing !== null && closing.char === opening.char && closing.length >= opening.length
}

interface LocalIgnoreDirective {
  kind: 'disable' | 'enable' | 'disable-next-line'
  ruleIds: (keyof MarkdownSpaceRulesType)[] | null
}

/** 识别独占一行的 markdownlint 风格局部忽略指令。 */
function parseLocalIgnoreDirective(line: string): LocalIgnoreDirective | null {
  const match = /^<!--\s*(?:markdown-auto-space|mas)-(disable-next-line|disable|enable)(?:\s+([^]*?))?\s*-->$/.exec(line.trim())
  if (!match)
    return null

  const codeText = match[2]?.trim() ?? ''
  const ruleIds = codeText
    ? Object.entries(RULE_DIAGNOSTIC_MAP)
      .filter(([, meta]) => codeText.split(/\s+/).includes(meta.code))
      .map(([ruleId]) => ruleId as keyof MarkdownSpaceRulesType)
    : null
  return { kind: match[1] as LocalIgnoreDirective['kind'], ruleIds }
}

function allRuleIds(): (keyof MarkdownSpaceRulesType)[] {
  return Object.keys(DEFAULT_RULES) as (keyof MarkdownSpaceRulesType)[]
}

function applyDisabledRules(
  rules: MarkdownSpaceRulesType,
  disabled: Set<keyof MarkdownSpaceRulesType>,
): MarkdownSpaceRulesType {
  const result = { ...rules }
  for (const ruleId of disabled)
    result[ruleId] = false
  return result
}

interface LineProcessingInfo {
  skippedLineIndices: Set<number>
  rulesByLine: Map<number, MarkdownSpaceRulesType>
}

function getLineProcessingInfo(
  content: string,
  rules: MarkdownSpaceRulesType = DEFAULT_RULES,
): LineProcessingInfo {
  const lines = content.split('\n')
  const skippedLineIndices = new Set<number>()
  const rulesByLine = new Map<number, MarkdownSpaceRulesType>()
  let codeFence: FencedCodeMarker | null = null
  const isYamlDelimiter = (line: string) => line === '---' || line === '---\r'
  let inYamlFrontMatter = isYamlDelimiter(lines[0] ?? '')
  const disabled = new Set<keyof MarkdownSpaceRulesType>()
  let nextLineDirective: LocalIgnoreDirective | null = null
  const htmlBlockTags: string[] = []
  let inHtmlComment = false
  let templateCloser: '}' | '}}' | null = null

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    const stripped = line.trim()

    if (inYamlFrontMatter) {
      skippedLineIndices.add(lineIndex)
      if (lineIndex > 0 && isYamlDelimiter(line))
        inYamlFrontMatter = false
      continue
    }
    if (stripped === '---') {
      skippedLineIndices.add(lineIndex)
      nextLineDirective = null
      continue
    }
    // Reference-link definitions are syntax, not prose. Keep their labels,
    // destinations and optional titles byte-for-byte intact.
    if (/^\s*\[[^\]]+\]:/.test(line)) {
      skippedLineIndices.add(lineIndex)
      nextLineDirective = null
      continue
    }
    if (codeFence !== null) {
      skippedLineIndices.add(lineIndex)
      nextLineDirective = null
      if (closesFence(line, codeFence))
        codeFence = null
      continue
    }

    // HTML blocks (including multiline comments) are opaque. This also covers
    // JSX/MDX tags with lowercase HTML-like block names without touching prose
    // on surrounding lines.
    if (inHtmlComment) {
      skippedLineIndices.add(lineIndex)
      if (line.includes('-->'))
        inHtmlComment = false
      continue
    }
    if (htmlBlockTags.length > 0) {
      skippedLineIndices.add(lineIndex)
      const tags = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi
      let tagMatch: RegExpExecArray | null
      while ((tagMatch = tags.exec(line)) !== null) {
        const tag = tagMatch[1]!.toLowerCase()
        if (tagMatch[0]!.startsWith('</')) {
          const last = htmlBlockTags[htmlBlockTags.length - 1]
          if (last === tag)
            htmlBlockTags.pop()
        }
        else if (!/\/\s*>$/.test(tagMatch[0]!)) {
          htmlBlockTags.push(tag)
        }
      }
      continue
    }
    if (templateCloser !== null) {
      skippedLineIndices.add(lineIndex)
      if (line.includes(templateCloser))
        templateCloser = null
      continue
    }
    if (line.includes('<!--') && !line.includes('-->')) {
      skippedLineIndices.add(lineIndex)
      inHtmlComment = true
      continue
    }
    const htmlBlockOpening = /<([a-z][a-z0-9-]*)\b[^>]*>/i.exec(line)
    if (htmlBlockOpening && !/\/\s*>$/.test(htmlBlockOpening[0])) {
      const tag = htmlBlockOpening[1]!
      if (/^[A-Z]/.test(tag) || /^(address|article|aside|blockquote|details|dialog|div|fieldset|figcaption|figure|footer|form|h[1-6]|header|main|nav|ol|p|pre|script|section|style|table|tbody|td|tfoot|th|thead|tr|ul)$/.test(tag.toLowerCase())) {
        const close = new RegExp(`</${tag}\\s*>`, 'i')
        if (!close.test(line.slice(htmlBlockOpening.index + htmlBlockOpening[0].length))) {
          skippedLineIndices.add(lineIndex)
          htmlBlockTags.push(tag.toLowerCase())
          continue
        }
      }
    }
    const doubleTemplateStart = line.indexOf('{{')
    const singleTemplateStart = line.indexOf('${')
    if (doubleTemplateStart >= 0 && line.indexOf('}}', doubleTemplateStart + 2) < 0) {
      skippedLineIndices.add(lineIndex)
      templateCloser = '}}'
      continue
    }
    if (singleTemplateStart >= 0 && line.indexOf('}', singleTemplateStart + 2) < 0) {
      skippedLineIndices.add(lineIndex)
      templateCloser = '}'
      continue
    }

    const directive = parseLocalIgnoreDirective(line)
    if (directive !== null) {
      skippedLineIndices.add(lineIndex)
      if (directive.kind === 'disable' || directive.kind === 'enable') {
        const ids = directive.ruleIds ?? allRuleIds()
        for (const ruleId of ids) {
          if (directive.kind === 'disable')
            disabled.add(ruleId)
          else
            disabled.delete(ruleId)
        }
      }
      else if (directive.kind === 'disable-next-line') {
        nextLineDirective = directive
      }
      continue
    }

    const opening = parseFenceOpening(line)
    if (opening !== null) {
      codeFence = opening
      skippedLineIndices.add(lineIndex)
      nextLineDirective = null
      continue
    }

    if (/^(\t| {4})/.test(line)) {
      skippedLineIndices.add(lineIndex)
      nextLineDirective = null
      continue
    }

    const lineDisabled = new Set(disabled)
    if (nextLineDirective !== null) {
      for (const ruleId of nextLineDirective.ruleIds ?? allRuleIds())
        lineDisabled.add(ruleId)
      nextLineDirective = null
    }
    rulesByLine.set(lineIndex, applyDisabledRules(rules, lineDisabled))
  }

  return { skippedLineIndices, rulesByLine }
}

/**
 *
 * @param line
 */
export function shouldSkipLine(line: string): boolean {
  const stripped = line.trim()
  if (stripped === '---')
    return true
  if (parseFenceOpening(line) !== null || parseFenceClosing(line) !== null)
    return true
  if (/^(\t| {4})/.test(line))
    return true
  if (stripped.startsWith('<') && stripped.endsWith('>'))
    return true
  if (/^\[.+\]:\s*http/.test(stripped))
    return true
  return false
}

/**
 *
 * @param content
 */
export function getSkippedLineIndices(content: string): Set<number> {
  // YAML front matter is only valid when the document starts with its opening
  // delimiter. An unclosed block remains protected to avoid modifying content
  // whose metadata boundary is ambiguous.
  return getLineProcessingInfo(content).skippedLineIndices
}

/**
 *
 * @param content
 * @param rules
 */
export function processMarkdownContent(
  content: string,
  rules: MarkdownSpaceRulesType = DEFAULT_RULES,
  units: DigitUnitOptions = {},
  languageId = 'markdown',
): string {
  const protection = languageId === 'mdx' ? protectMdxContent(content) : undefined
  content = protection?.text ?? content
  const lines = content.split(/\r\n|\n/)
  const lineBreaks = content.match(/\r\n|\n/g) ?? []
  const processingInfo = getLineProcessingInfo(content, rules)
  const newLines: string[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    if (processingInfo.skippedLineIndices.has(lineIndex)) {
      newLines.push(line)
      continue
    }

    newLines.push(addSpacesBetweenChineseAndAlnum(line, processingInfo.rulesByLine.get(lineIndex) ?? rules, units))
  }

  const result = newLines.map((line, index) => line + (lineBreaks[index] ?? '')).join('')
  return protection ? protection.restore(result) : result
}

export interface MarkdownSpaceViolation {
  lineIndex: number
  start: number
  length: number
  ruleId: keyof MarkdownSpaceRulesType
  code: string
  message: string
}

/**
 *
 * @param content
 * @param rules
 */
export function getMarkdownSpaceViolations(
  content: string,
  rules: MarkdownSpaceRulesType = DEFAULT_RULES,
  units: DigitUnitOptions = {},
  languageId = 'markdown',
): MarkdownSpaceViolation[] {
  if (languageId === 'mdx')
    content = protectMdxContent(content).text
  const lines = content.split('\n')
  const processingInfo = getLineProcessingInfo(content, rules)
  const out: MarkdownSpaceViolation[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    if (processingInfo.skippedLineIndices.has(lineIndex))
      continue

    const lineViolations = getLineViolations(line, processingInfo.rulesByLine.get(lineIndex) ?? rules, units)
    for (const v of lineViolations) {
      out.push({
        lineIndex,
        start: v.start,
        length: v.length,
        ruleId: v.ruleId,
        code: v.code,
        message: v.message,
      })
    }
  }
  return out
}
