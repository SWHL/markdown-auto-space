import type { MarkdownSpaceRulesType } from './type'

/**
 * Markdown 中文与英文/数字间加空格
 * 各规则可通过 settings 中 markdownAutoSpace.rules 单独开关
 */

const PROTECTED_PLACEHOLDER = '__PROTECTED_'

const DEFAULT_RULES: MarkdownSpaceRulesType = {
  chineseAlnum: true,
  chineseBacktick: true,
  chineseLinkUrl: true,
  chineseLinkText: true,
  dunhaoToComma: true,
  slashSpace: true,
}

/** 规则码与说明（用于诊断提示，类似 markdownlint 的 MDxxx） */
export const RULE_DIAGNOSTIC_MAP: Record<keyof MarkdownSpaceRulesType, { code: string, message: string }> = {
  chineseAlnum: { code: 'MAS001', message: '中英文/数字之间应有空格' },
  chineseBacktick: { code: 'MAS002', message: '中文与行内代码（反引号）之间应有空格' },
  chineseLinkUrl: { code: 'MAS003', message: '中文与链接/URL 之间应有空格' },
  chineseLinkText: { code: 'MAS006', message: '超链接 [] 内中英文混排时英文左右应有空格' },
  dunhaoToComma: { code: 'MAS004', message: '英文/数字间的顿号应改为逗号+空格' },
  slashSpace: { code: 'MAS005', message: '斜杠与中文之间应有空格' },
}

/**
 * 比较原始行与处理后行，找出「插入空格」的位置（在原始行中的起始下标，高亮两字符）
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
 * 对单行检测违反规则的位置，返回用于诊断的区间与规则信息（仅对当前启用的规则）
 */
export function getLineViolations(
  line: string,
  rules: MarkdownSpaceRulesType,
): { start: number, length: number, ruleId: keyof MarkdownSpaceRulesType, code: string, message: string }[] {
  const violations: { start: number, length: number, ruleId: keyof MarkdownSpaceRulesType, code: string, message: string }[] = []
  const ruleKeys = (Object.keys(rules) as (keyof MarkdownSpaceRulesType)[]).filter(k => rules[k])
  const seenStarts = new Set<number>()
  for (const ruleId of ruleKeys) {
    const onlyThisRule: MarkdownSpaceRulesType = {
      chineseAlnum: false,
      chineseBacktick: false,
      chineseLinkUrl: false,
      chineseLinkText: false,
      dunhaoToComma: false,
      slashSpace: false,
      [ruleId]: true,
    }
    const output = addSpacesBetweenChineseAndAlnum(line, onlyThisRule)
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
 * @param options 未传则全部规则启用（与旧行为一致）
 */
export function addSpacesBetweenChineseAndAlnum(
  text: string,
  options: MarkdownSpaceRulesType = DEFAULT_RULES,
): string {
  const protectedItems: string[] = []

  function saveItem(match: string): string {
    protectedItems.push(match)
    return `${PROTECTED_PLACEHOLDER}${protectedItems.length - 1}__`
  }

  let result = text

  // 1. 保护反引号包裹的 inline code（最高优先级，内部可为任意内容）
  // 支持 1 个或多个反引号作为定界符：`code`、``a ` b`` 等
  result = result.replace(/(`+)([\s\S]*?)\1/g, saveItem)

  // 2. 保护 Markdown 图片语法 ![](url) 或 ![alt](url)，避免 URL 内 / 被加空格
  result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, saveItem)

  // 3. 保护 Markdown 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, saveItem)

  // 4. 保护 HTML 标签
  result = result.replace(/<\/?[a-zA-Z][^>]*>/g, saveItem)

  // 5. 保护独立 URL
  result = result.replace(/https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g, saveItem)

  // 6. 保护引号中的内容，一律不参与后续空格规则
  result = result.replace(/"[^"]*"/g, saveItem)
  result = result.replace(/'[^']*'/g, saveItem)

  // 7. 保护 **粗体**
  result = result.replace(/\*\*[^*]+\*\*/g, saveItem)

  // 8. 英文/数字/反引号等之间的中文顿号 -> 英文逗号+空格
  if (options.dunhaoToComma) {
    result = result.replace(
      /([a-zA-Z0-9`+\-*/=])、(?=[a-zA-Z0-9`])/g,
      '$1, ',
    )
  }

  // 9. 10. / 左右加空格（仅当一侧为中文时，左右均为英文/数字如 release/v3.0 不加）
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

  // 11. 12. 中文与反引号之间加空格
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

  // 13. 14. 中文与占位符(链接/URL)之间加空格
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

  // 15. 16. 中文与英文/数字之间加空格
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

  // 恢复被保护的内容；支持嵌套占位符，循环恢复直到稳定，避免泄漏 __PROTECTED_x__
  const placeholderRegex = new RegExp(`${PROTECTED_PLACEHOLDER}(\\d+)__`, 'g')
  function restoreOnePass(input: string): string {
    return input.replace(placeholderRegex, (fullMatch, indexStr) => {
      const i = Number.parseInt(indexStr, 10)
      let item = protectedItems[i]
      // 文档中可能含有字面量 __PROTECTED_0__ 等，导致索引越界，原样保留避免报错
      if (item === undefined)
        return fullMatch
      const linkMatch = item.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      // 仅对普通链接 [text](url) 处理链接文本中的空格（MAS006），图片 ![alt](url) 原样恢复
      if (linkMatch && !linkMatch[1].startsWith('!')) {
        const [, linkText, linkUrl] = linkMatch
        item = `[${addSpacesInText(linkText, options.chineseLinkText)}](${linkUrl})`
      }
      return item
    })
  }

  // 最多迭代 protectedItems.length + 1 次，足以展开所有嵌套，避免异常输入导致死循环
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
 * @param apply 为 false 时不处理，直接返回原文
 */
export function addSpacesInText(text: string, apply = true): string {
  if (!apply) return text
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
 * 是否应跳过该行（不参与加空格处理）
 */
export function shouldSkipLine(line: string): boolean {
  const stripped = line.trim()
  if (stripped === '---') return true
  if (stripped.startsWith('```')) return true
  if (stripped.startsWith('<') && stripped.endsWith('>')) return true
  if (/^\[.+\]:\s*http/.test(stripped)) return true
  return false
}

/**
 * 处理整篇 Markdown 内容：跳过代码块与 YAML front matter 内的行，其余行做加空格
 * @param rules 未传则全部规则启用
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
      if (yamlFrontMatterCount <= 2) {
        inYamlFrontMatter = yamlFrontMatterCount === 1
      }
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

    // 缩进代码块（行首 4 空格或 1 tab）：代码中内容一律不处理
    if (/^(\t|    )/.test(line)) {
      newLines.push(line)
      continue
    }

    newLines.push(addSpacesBetweenChineseAndAlnum(line, rules))
  }

  return newLines.join('\n')
}

/** 单条诊断项（行、列、规则、文案），供扩展层转成 vscode.Diagnostic */
export interface MarkdownSpaceViolation {
  lineIndex: number
  start: number
  length: number
  ruleId: keyof MarkdownSpaceRulesType
  code: string
  message: string
}

/**
 * 对整篇 Markdown 做与 processMarkdownContent 相同的行过滤，收集所有违规位置
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
    const line = lines[lineIndex]
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
    if (/^(\t|    )/.test(line))
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
