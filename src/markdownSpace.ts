import type { MarkdownSpaceRulesType } from './type'

/**
 * Markdown 中文与英文/数字间加空格
 * 各规则可通过 settings 中 markdownAutoSpace.rules 单独开关
 */

const PROTECTED_PLACEHOLDER = '__PROTECTED_'

/** 数字与单位：按长度降序，避免 Mbps 被拆成 M + bps */
const DIGIT_UNIT_SUFFIXES = [
  'Gbps', 'Mbps', 'Kbps', 'TiB', 'GiB', 'MiB', 'KiB', 'THz', 'GHz', 'MHz', 'kHz',
  'mAh', 'dpi', 'bps', 'TB', 'GB', 'MB', 'KB', 'Hz', 'ms', 'ns', 'px', 'V', 'W',
] as const

const DIGIT_UNIT_PATTERN = DIGIT_UNIT_SUFFIXES.join('|')

/**
 * 数字（可含一位小数）与单位之间加空格，不与字母数字粘连
 * @param text
 */
export function applyDigitUnitSpace(text: string): string {
  const re = new RegExp(
    `(?<![A-Za-z0-9_])(\\d+(?:\\.\\d+)?)(${DIGIT_UNIT_PATTERN})(?![A-Za-z0-9])`,
    'g',
  )
  return text.replace(re, '$1 $2')
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
    result = result.replace(/(\d+)\s+([°%％])/g, '$1$2')
  }
  result = result.replace(/([°%％])(?=[\u4e00-\u9fff])/g, '$1 ')
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
function applyLinkTextPostRules(linkText: string, options: MarkdownSpaceRulesType): string {
  let lt = linkText
  if (options.digitUnitSpace)
    lt = applyDigitUnitSpace(lt)
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
export const RULE_DIAGNOSTIC_MAP: Record<keyof MarkdownSpaceRulesType, { code: string, message: string }> = {
  chineseAlnum: { code: 'MAS001', message: '中英文/数字之间应有空格' },
  chineseBacktick: { code: 'MAS002', message: '中文与行内代码（反引号）之间应有空格' },
  chineseLinkUrl: { code: 'MAS003', message: '中文与链接/URL 之间应有空格' },
  chineseLinkText: { code: 'MAS006', message: '超链接 [] 内中英文混排时英文左右应有空格' },
  dunhaoToComma: { code: 'MAS004', message: '英文/数字间的顿号应改为逗号+空格' },
  slashSpace: { code: 'MAS005', message: '斜杠与中文之间应有空格' },
  digitUnitSpace: { code: 'MAS007', message: '数字与单位之间应有空格' },
  tightDegreePercent: { code: 'MAS008', message: '度数、百分号与数字之间不应有空格' },
  noSpaceAroundCjkPunct: { code: 'MAS009', message: '全形标点旁不应有空格' },
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
function collectProtectedRanges(line: string): [number, number][] {
  const patterns = [
    /(`+)([\s\S]*?)\1/g,
    /!\[[^\]]*\]\([^)]+\)/g,
    /\[([^\]]+)\]\(([^)]+)\)/g,
    /<\/?[a-zA-Z][^>]*>/g,
    /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g,
    /"[^"]*"/g,
    /'[^']*'/g,
    /\*\*[^*]+\*\*/g,
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

/**
 *
 * @param ranges
 * @param start
 * @param end
 */
function rangeOverlaps(ranges: [number, number][], start: number, end: number): boolean {
  return ranges.some(([a, b]) => start < b && end > a)
}

const DIGIT_UNIT_VIOLATION_RE = new RegExp(
  `(?<![A-Za-z0-9_])(\\d+(?:\\.\\d+)?)(${DIGIT_UNIT_PATTERN})(?![A-Za-z0-9])`,
  'g',
)

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
): { start: number, length: number, ruleId: keyof MarkdownSpaceRulesType, code: string, message: string }[] {
  const violations: { start: number, length: number, ruleId: keyof MarkdownSpaceRulesType, code: string, message: string }[] = []
  const protectedRanges = collectProtectedRanges(line)
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
    DIGIT_UNIT_VIOLATION_RE.lastIndex = 0
    while ((m = DIGIT_UNIT_VIOLATION_RE.exec(line)) !== null) {
      const num = m[1]!
      const start = m.index + num.length
      const end = start + (m[2]!.length)
      if (!rangeOverlaps(protectedRanges, m.index, end))
        pushUnique(start > 0 ? start - 1 : start, Math.min(2, line.length - (start > 0 ? start - 1 : start)), 'digitUnitSpace')
    }
  }

  if (rules.tightDegreePercent) {
    const re = /(\d+)(\s+)([°%％])/g
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
): string {
  const protectedItems: string[] = []

  /**
   *
   * @param match
   */
  function saveItem(match: string): string {
    protectedItems.push(match)
    return `${PROTECTED_PLACEHOLDER}${protectedItems.length - 1}__`
  }

  let result = text

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
    result = applyDigitUnitSpace(result)

  if (options.tightDegreePercent)
    result = applyTightDegreePercent(result)

  if (options.noSpaceAroundCjkPunct)
    result = applyNoSpaceAroundCjkPunct(result)

  const placeholderRegex = new RegExp(`${PROTECTED_PLACEHOLDER}(\\d+)__`, 'g')
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
      if (linkMatch && !linkMatch[1].startsWith('!')) {
        const [, linkText, linkUrl] = linkMatch
        item = `[${applyLinkTextPostRules(linkText, options)}](${linkUrl})`
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

/**
 *
 * @param line
 */
export function shouldSkipLine(line: string): boolean {
  const stripped = line.trim()
  if (stripped === '---')
    return true
  if (stripped.startsWith('```'))
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
 * @param rules
 */
export function processMarkdownContent(
  content: string,
  rules: MarkdownSpaceRulesType = DEFAULT_RULES,
): string {
  const lines = content.split('\n')
  const newLines: string[] = []
  let inCodeBlock = false
  let inYamlFrontMatter = false
  let yamlFrontMatterCount = 0

  for (const line of lines) {
    if (line.trim() === '---') {
      yamlFrontMatterCount += 1
      if (yamlFrontMatterCount <= 2)
        inYamlFrontMatter = yamlFrontMatterCount === 1
    }

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      newLines.push(line)
      continue
    }

    if (inCodeBlock || inYamlFrontMatter) {
      newLines.push(line)
      continue
    }

    if (/^(\t| {4})/.test(line)) {
      newLines.push(line)
      continue
    }

    newLines.push(addSpacesBetweenChineseAndAlnum(line, rules))
  }

  return newLines.join('\n')
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
): MarkdownSpaceViolation[] {
  const lines = content.split('\n')
  const out: MarkdownSpaceViolation[] = []
  let inCodeBlock = false
  let inYamlFrontMatter = false
  let yamlFrontMatterCount = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    if (line.trim() === '---') {
      yamlFrontMatterCount += 1
      if (yamlFrontMatterCount <= 2)
        inYamlFrontMatter = yamlFrontMatterCount === 1
    }
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock || inYamlFrontMatter)
      continue
    if (/^(\t| {4})/.test(line))
      continue

    const lineViolations = getLineViolations(line, rules)
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
