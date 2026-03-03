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
  dunhaoToComma: true,
  slashSpace: true,
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
    return input.replace(placeholderRegex, (_, indexStr) => {
      const i = Number.parseInt(indexStr, 10)
      let item = protectedItems[i]
      const linkMatch = item.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      // 仅对普通链接 [text](url) 处理链接文本中的空格，图片 ![alt](url) 原样恢复
      if (linkMatch && !linkMatch[1].startsWith('!')) {
        const [, linkText, linkUrl] = linkMatch
        item = `[${addSpacesInText(linkText, options.chineseAlnum)}](${linkUrl})`
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
