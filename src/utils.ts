// import type { TextEditorEdit } from 'vscode'
import type { TextDocument } from 'vscode'
import { Diagnostic, DiagnosticSeverity, languages as Languages, Range, RelativePattern, TextEdit, Uri, window as Window, workspace as Workspace } from 'vscode'
import { getMarkdownSpaceViolations, processMarkdownContent } from './markdownSpace'
import type { AutoSpaceConfigType } from './type'
import { getRuleDocUrl, normalizeRules } from './type'

interface TextChange {
  start: number
  end: number
  newText: string
}

/**
 * 根据原文和格式化结果生成最小的、按原文偏移排序的编辑。
 * 格式化规则主要由空格插入/删除和少量字符替换组成，线性扫描即可避免
 * 为大文档构造 O(n²) 的通用字符串 diff，同时保持换行符不被触碰。
 */
function getMinimalLineChanges(original: string, updated: string): TextChange[] {
  const changes: TextChange[] = []
  let originalIndex = 0
  let updatedIndex = 0

  const append = (change: TextChange) => {
    const previous = changes[changes.length - 1]
    if (previous && previous.end === change.start) {
      previous.end = change.end
      previous.newText += change.newText
    }
    else {
      changes.push(change)
    }
  }

  while (originalIndex < original.length || updatedIndex < updated.length) {
    if (originalIndex < original.length
      && updatedIndex < updated.length
      && original[originalIndex] === updated[updatedIndex]) {
      originalIndex += 1
      updatedIndex += 1
      continue
    }

    // The formatter inserts spaces without consuming an original character.
    if (/\s/.test(updated[updatedIndex] ?? '') && !/\s/.test(original[originalIndex] ?? '')) {
      append({ start: originalIndex, end: originalIndex, newText: updated[updatedIndex]! })
      updatedIndex += 1
      continue
    }

    // The formatter removes redundant whitespace from the original text.
    if (/\s/.test(original[originalIndex] ?? '') && !/\s/.test(updated[updatedIndex] ?? '')) {
      append({ start: originalIndex, end: originalIndex + 1, newText: '' })
      originalIndex += 1
      continue
    }

    // Covers punctuation changes such as 顿号 -> comma.
    if (originalIndex < original.length && updatedIndex < updated.length) {
      append({ start: originalIndex, end: originalIndex + 1, newText: updated[updatedIndex]! })
      originalIndex += 1
      updatedIndex += 1
      continue
    }

    if (originalIndex < original.length) {
      append({ start: originalIndex, end: originalIndex + 1, newText: '' })
      originalIndex += 1
    }
    else {
      append({ start: originalIndex, end: originalIndex, newText: updated[updatedIndex]! })
      updatedIndex += 1
    }
  }

  return changes
}

function getMinimalTextChanges(original: string, updated: string): TextChange[] {
  const changes: TextChange[] = []
  const originalLines = original.split(/\r\n|\n/)
  const updatedLines = updated.split(/\r\n|\n/)
  const originalBreaks = original.match(/\r\n|\n/g) ?? []
  let originalOffset = 0

  for (let line = 0; line < originalLines.length; line++) {
    const originalLine = originalLines[line]!
    const updatedLine = updatedLines[line]!
    for (const change of getMinimalLineChanges(originalLine, updatedLine))
      changes.push({ start: originalOffset + change.start, end: originalOffset + change.end, newText: change.newText })
    originalOffset += originalLine.length + (originalBreaks[line]?.length ?? 0)
  }
  return changes
}

function getMinimalTextEdits(
  document: TextDocument,
  original: string,
  updated: string,
  baseOffset = 0,
): TextEdit[] | undefined {
  if (original === updated)
    return undefined
  const changes = getMinimalTextChanges(original, updated)
  if (changes.length === 0)
    return undefined

  return changes.map(({ start, end, newText }) => TextEdit.replace(
    new Range(
      document.positionAt(baseOffset + start),
      document.positionAt(baseOffset + end),
    ),
    newText,
  ))
}

/**
 *
 */
export function getMarkdownAutoSpaceConfig(document?: TextDocument): AutoSpaceConfigType {
  const config = Workspace.getConfiguration('markdownAutoSpace', document?.uri)
  const formatOnSave = config.get('formatOnSave') as boolean
  const formatOnDocument = config.get('formatOnDocument') as boolean
  const excludeRaw = config.get<unknown>('exclude')
  const exclude = Array.isArray(excludeRaw)
    ? excludeRaw.filter((pattern): pattern is string => typeof pattern === 'string')
    : []
  const rulesRaw = config.get('rules') as Record<string, boolean> | undefined
  const rules = normalizeRules(rulesRaw)
  const unitsRaw = config.get('units') as Record<string, unknown> | undefined
  const units = {
    additional: [
      ...(Array.isArray(unitsRaw?.additional) ? unitsRaw.additional : []),
      ...(Array.isArray(unitsRaw?.include) ? unitsRaw.include : []),
    ].filter((unit): unit is string => typeof unit === 'string'),
    exclude: Array.isArray(unitsRaw?.exclude) ? unitsRaw.exclude.filter((unit): unit is string => typeof unit === 'string') : [],
  }
  return {
    formatOnSave,
    formatOnDocument,
    exclude,
    rules,
    units,
  }
}

/**
 * Match exclusions relative to the containing workspace folder. A plain glob
 * is used outside a workspace, where VS Code matches against the document path.
 * RelativePattern also works for virtual workspace schemes used by VS Code Web.
 * @param document
 */
export function isExcluded(document: TextDocument): boolean {
  const { exclude } = getMarkdownAutoSpaceConfig(document)
  if (!exclude.length)
    return false

  const workspaceFolder = Workspace.getWorkspaceFolder(document.uri)
  return exclude.some((pattern) => {
    if (!pattern.trim())
      return false
    try {
      const glob = workspaceFolder ? new RelativePattern(workspaceFolder, pattern) : pattern
      return Languages.match({ pattern: glob }, document) > 0
    }
    catch {
      // Ignore malformed user patterns rather than disabling document processing.
      return false
    }
  })
}

/** Only process Markdown documents that do not match an exclusion glob. */
export function shouldProcessFile(document: TextDocument): boolean {
  return document.languageId === 'markdown' && !isExcluded(document)
}

/**
 * 根据文档与文本计算加空格后的编辑（不依赖当前焦点编辑器），用于保存时应用。
 * @param document
 * @param text
 */
export function getMarkdownAutoSpaceEdits(
  document: TextDocument,
  text: string,
): TextEdit[] | undefined {
  if (!shouldProcessFile(document))
    return undefined

  const { rules, units } = getMarkdownAutoSpaceConfig(document)
  const updatedText = processMarkdownContent(text, rules, units)
  return getMinimalTextEdits(document, text, updatedText)
}

/** Return the number of elementary text changes produced by document formatting. */
export function getMarkdownAutoSpaceChangeCount(document: TextDocument, text: string): number {
  if (!shouldProcessFile(document))
    return 0
  const { rules, units } = getMarkdownAutoSpaceConfig(document)
  return getMinimalTextChanges(text, processMarkdownContent(text, rules, units)).length
}

/** Return the number of current violations for each MAS rule. */
export function getMarkdownAutoSpaceRuleHitCounts(document: TextDocument, text: string): Record<string, number> {
  if (!shouldProcessFile(document))
    return {}
  const { rules, units } = getMarkdownAutoSpaceConfig(document)
  const counts: Record<string, number> = {}
  for (const violation of getMarkdownSpaceViolations(text, rules, units))
    counts[violation.code] = (counts[violation.code] ?? 0) + 1
  return counts
}

/**
 * 计算当前文档的「加空格」规则诊断（类似 markdownlint 的 MD022 等）
 * 仅对 Markdown 文档且配置开启时返回
 * @param document
 * @param text
 */
export function getMarkdownAutoSpaceDiagnostics(
  document: TextDocument,
  text: string,
): Diagnostic[] {
  if (!shouldProcessFile(document))
    return []
  const config = Workspace.getConfiguration('markdownAutoSpace', document.uri)
  const diagnosticsEnabled = config.get('diagnostics.enable') as boolean | undefined
  if (diagnosticsEnabled === false)
    return []

  const { rules, units } = getMarkdownAutoSpaceConfig(document)
  const violations = getMarkdownSpaceViolations(text, rules, units)
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
 * @param text
 */
export function markdownAutoSpace(text: string) {
  const editor = Window.activeTextEditor
  if (!editor)
    return
  const document = editor.document
  if (!shouldProcessFile(document))
    return

  const { rules, units } = getMarkdownAutoSpaceConfig(document)
  const updatedText = processMarkdownContent(text, rules, units)
  return getMinimalTextEdits(document, text, updatedText)
}
