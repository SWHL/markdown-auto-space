// import type { TextEditorEdit } from 'vscode'
import type { TextDocument } from 'vscode'
import { Diagnostic, DiagnosticSeverity, Range, TextEdit, Uri, window as Window, workspace as Workspace } from 'vscode'
import { addSpacesBetweenChineseAndAlnum, getMarkdownSpaceViolations, processMarkdownContent } from './markdownSpace'
import type { AutoSpaceConfigType, MarkdownSpaceRulesType } from './type'
import { DEFAULT_MARKDOWN_SPACE_RULES, getRuleDocUrl, normalizeRules } from './type'

/**
 *
 */
export function getMarkdownAutoSpaceConfig(): AutoSpaceConfigType {
  const config = Workspace.getConfiguration('markdownAutoSpace')
  const formatOnSave = config.get('formatOnSave') as boolean
  const formatOnDocument = config.get('formatOnDocument') as boolean
  const spaceType = config.get('spaceType') as AutoSpaceConfigType['spaceType']
  const rulesRaw = config.get('rules') as Record<string, boolean> | undefined
  const rules = normalizeRules(rulesRaw)
  return {
    formatOnSave,
    formatOnDocument,
    spaceType,
    rules,
  }
}

/** 仅对 Markdown 语言的文件处理 */
export function shouldProcessFile(document: TextDocument): boolean {
  return document.languageId === 'markdown'
}

/**
 * 根据文档与文本计算加空格后的编辑（不依赖当前焦点编辑器），用于保存时应用。
 */
export function getMarkdownAutoSpaceEdits(
  document: TextDocument,
  text: string,
): TextEdit[] | undefined {
  if (!shouldProcessFile(document))
    return undefined

  const { rules } = getMarkdownAutoSpaceConfig()
  const updatedText = processMarkdownContent(text, rules ?? DEFAULT_MARKDOWN_SPACE_RULES)
  const fullRange = new Range(
    document.positionAt(0),
    document.positionAt(text.length),
  )
  return [TextEdit.replace(fullRange, updatedText)]
}

/**
 * 仅对选中范围（或单行）做加空格，用于「格式化选中」命令。按行处理，不依赖全文代码块上下文。
 */
export function getMarkdownAutoSpaceEditsForRange(
  document: TextDocument,
  range: Range,
): TextEdit[] | undefined {
  if (!shouldProcessFile(document))
    return undefined
  const text = document.getText(range)
  if (!text.length)
    return undefined
  const { rules } = getMarkdownAutoSpaceConfig()
  const lines = text.split('\n')
  const formatted = lines.map(line => addSpacesBetweenChineseAndAlnum(line, rules ?? DEFAULT_MARKDOWN_SPACE_RULES))
  const newText = formatted.join('\n')
  if (newText === text)
    return undefined
  return [TextEdit.replace(range, newText)]
}

/**
 * 计算当前文档的「加空格」规则诊断（类似 markdownlint 的 MD022 等）
 * 仅对 Markdown 文档且配置开启时返回
 */
export function getMarkdownAutoSpaceDiagnostics(
  document: TextDocument,
  text: string,
): Diagnostic[] {
  if (!shouldProcessFile(document))
    return []
  const config = Workspace.getConfiguration('markdownAutoSpace')
  const diagnosticsEnabled = config.get('diagnostics.enable') as boolean | undefined
  if (diagnosticsEnabled === false)
    return []

  const { rules } = getMarkdownAutoSpaceConfig()
  const violations = getMarkdownSpaceViolations(text, rules ?? DEFAULT_MARKDOWN_SPACE_RULES)
  const diagnostics: Diagnostic[] = []
  for (const v of violations) {
    if (v.lineIndex >= document.lineCount)
      continue
    const line = document.lineAt(v.lineIndex)
    const range = new Range(
      line.range.start.translate(0, v.start),
      line.range.start.translate(0, Math.min(v.start + v.length, line.text.length)),
    )
    const diagnostic = new Diagnostic(
      range,
      `${v.message} [${v.code}]`,
      DiagnosticSeverity.Information,
    )
    diagnostic.code = {
      value: v.code,
      target: Uri.parse(getRuleDocUrl(v.code)),
    }
    diagnostic.source = 'markdown-auto-space'
    diagnostics.push(diagnostic)
  }
  return diagnostics
}

/**
 * 对当前活动编辑器的文档执行加空格并返回编辑（供命令/格式化使用）。
 */
export function markdownAutoSpace(text: string) {
  const editor = Window.activeTextEditor
  if (!editor)
    return
  const document = editor.document
  if (!shouldProcessFile(document))
    return

  const { rules } = getMarkdownAutoSpaceConfig()
  const updatedText = processMarkdownContent(text, rules ?? DEFAULT_MARKDOWN_SPACE_RULES)
  const fullRange = new Range(
    document.positionAt(0),
    document.positionAt(text.length),
  )
  return [TextEdit.replace(fullRange, updatedText)]
}
