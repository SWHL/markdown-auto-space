// import type { TextEditorEdit } from 'vscode'
import type { TextDocument } from 'vscode'
import { Range, TextEdit, window as Window, workspace as Workspace } from 'vscode'
import { processMarkdownContent } from './markdownSpace'
import type { AutoSpaceConfigType, MarkdownSpaceRulesType } from './type'
import { DEFAULT_MARKDOWN_SPACE_RULES } from './type'

/**
 *
 */
export function getMarkdownAutoSpaceConfig(): AutoSpaceConfigType {
  const config = Workspace.getConfiguration('markdownAutoSpace')
  const formatOnSave = config.get('formatOnSave') as boolean
  const formatOnDocument = config.get('formatOnDocument') as boolean
  const spaceType = config.get('spaceType') as AutoSpaceConfigType['spaceType']
  const rulesRaw = config.get('rules') as Record<string, boolean> | undefined
  const rules: MarkdownSpaceRulesType = rulesRaw
    ? { ...DEFAULT_MARKDOWN_SPACE_RULES, ...rulesRaw }
    : DEFAULT_MARKDOWN_SPACE_RULES
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
