import * as vscode from 'vscode'
import { getRuleDocUrl } from './type'
import { RULE_DIAGNOSTIC_MAP } from './markdownSpace'
import { shouldProcessFile } from './utils'

const IGNORE_DIRECTIVE_RE = /^\s*<!--\s*(?:markdown-auto-space|mas)-(?:disable-next-line|disable|enable)\s+(?:MAS\d{3}\s+)*(?:[A-Z0-9]*)$/

function completionRange(position: vscode.Position, start: number): vscode.Range {
  return new vscode.Range(new vscode.Position(position.line, start), position)
}

function createDirectiveCompletionItems(position: vscode.Position, prefixLength: number) {
  return ['disable', 'enable', 'disable-next-line'].map((kind) => {
    const item = new vscode.CompletionItem(kind, vscode.CompletionItemKind.Keyword)
    item.insertText = kind
    item.range = completionRange(position, position.character - prefixLength)
    item.detail = 'Markdown Auto Space 局部忽略指令'
    item.documentation = new vscode.MarkdownString(kind === 'disable-next-line' ? '忽略下一行的规则。' : '开始或结束局部规则忽略。')
    return item
  })
}

function createRuleCompletionItems(document: vscode.TextDocument, position: vscode.Position, before: string) {
  const ruleTokenMatch = /(?:^|\s)([A-Z0-9]*)$/.exec(before)
  const tokenStart = ruleTokenMatch ? before.length - ruleTokenMatch[1]!.length : position.character
  const existingCodes = new Set(before.match(/MAS\d{3}/g) ?? [])
  return Object.values(RULE_DIAGNOSTIC_MAP)
    .filter(rule => !existingCodes.has(rule.code))
    .map((rule) => {
      const item = new vscode.CompletionItem(rule.code, vscode.CompletionItemKind.Enum)
      item.range = completionRange(position, tokenStart)
      item.detail = rule.message
      item.documentation = new vscode.MarkdownString(`${rule.description}\n\n${rule.examples.map(([input, output]) => `\`${input}\` → \`${output}\``).join('\n\n')}`)
      return item
    })
}

export function getRuleCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
  if (!shouldProcessFile(document))
    return []
  const before = document.lineAt(position.line).text.slice(0, position.character)
  const prefixMatch = /^\s*(<!--\s*(?:markdown-auto-space|mas)-)([a-z-]*)$/.exec(before)
  const items = prefixMatch ? createDirectiveCompletionItems(position, prefixMatch[2]!.length) : []
  if (!IGNORE_DIRECTIVE_RE.test(before))
    return items
  return items.concat(createRuleCompletionItems(document, position, before))
}

export function getRuleHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
  if (!shouldProcessFile(document))
    return undefined
  const line = document.lineAt(position.line).text
  if (!/^\s*<!--\s*(?:markdown-auto-space|mas)-(?:disable-next-line|disable|enable)(?:\s+[^<>]*?)?\s*-->\s*$/.test(line))
    return undefined
  const directiveMatch = /^\s*<!--\s*(?:markdown-auto-space|mas)-(?:disable-next-line|disable|enable)(?:\s+|$)/.exec(line)
  if (!directiveMatch)
    return undefined
  const directiveEnd = line.indexOf('-->', directiveMatch.index)
  if (directiveEnd < 0)
    return undefined
  const codeRegionStart = directiveMatch.index + directiveMatch[0].length
  const codeRegion = line.slice(codeRegionStart, directiveEnd)
  const codeRegex = /\bMAS\d{3}\b/g
  let codeMatch: RegExpExecArray | null
  let ruleCode: string | undefined
  while ((codeMatch = codeRegex.exec(codeRegion)) !== null) {
    const start = codeRegionStart + codeMatch.index
    if (position.character >= start && position.character < start + codeMatch[0].length) {
      ruleCode = codeMatch[0]
      break
    }
  }
  const rule = Object.values(RULE_DIAGNOSTIC_MAP).find(item => item.code === ruleCode)
  if (!rule)
    return undefined
  const examples = rule.examples.map(([input, output]) => `\`${input}\` → \`${output}\``).join('\n\n')
  const markdown = new vscode.MarkdownString(`**${rule.code}：${rule.message}**\n\n${rule.description}\n\n${examples}\n\n[查看完整规则文档](${getRuleDocUrl(rule.code)})`)
  return new vscode.Hover(markdown)
}
