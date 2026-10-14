import * as vscode from 'vscode'
import { getMarkdownAutoSpaceChangeCount, getMarkdownAutoSpaceConfig, getMarkdownAutoSpaceDiagnostics, getMarkdownAutoSpaceEdits, isExcluded, shouldProcessFile } from './utils'
import { getRuleDocUrl, shouldRunFormatOnSave } from './type'
import { RULE_DIAGNOSTIC_MAP } from './markdownSpace'

let outputChannel: vscode.OutputChannel
let diagnosticCollection: vscode.DiagnosticCollection
let statusBarItem: vscode.StatusBarItem | undefined
let statusTimer: ReturnType<typeof setTimeout> | undefined
const diagnosticsDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 *
 * @param msg
 */
function log(msg: string) {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${msg}`)
}

function showStatus(message: string) {
  if (statusTimer)
    clearTimeout(statusTimer)
  if (statusBarItem) {
    statusBarItem.text = message
    statusBarItem.tooltip = 'Markdown Auto Space'
    statusBarItem.show()
    statusTimer = setTimeout(() => statusBarItem?.hide(), 8000)
    return
  }
  void vscode.window.setStatusBarMessage?.(message, 8000)
}

/**
 * Recompute diagnostics from the document's current contents.
 * This is also called after save-time edits because an edit made from
 * onWillSave is not guaranteed to produce a timely onDidChange refresh.
 * @param doc
 */
function updateDiagnostics(doc: vscode.TextDocument) {
  if (!diagnosticCollection)
    return
  if (!shouldProcessFile(doc)) {
    diagnosticCollection.delete(doc.uri)
    return
  }
  const diagnostics = getMarkdownAutoSpaceDiagnostics(doc, doc.getText())
  diagnosticCollection.set(doc.uri, diagnostics)
}

/**
 * 计算文档格式化编辑。保存参与者会负责应用返回的编辑，命令路径则继续
 * 使用 workspace.applyEdit 主动应用编辑。
 * @param document
 */
function getFormatEdits(document: vscode.TextDocument): vscode.TextEdit[] {
  try {
    log(`getFormatEdits: ${document.uri.fsPath} languageId=${document.languageId}`)
    if (!shouldProcessFile(document)) {
      log('  Skipped: non-Markdown file')
      return []
    }

    const text = document.getText()
    const edits = getMarkdownAutoSpaceEdits(document, text) ?? []
    if (!edits.length) {
      log('  No edits needed')
      return []
    }

    log(`  Returning ${edits.length} edits for the save transaction`)
    return edits
  }
  catch (err) {
    log(`  Error: ${err instanceof Error ? err.message : String(err)}`)
    if (err instanceof Error && err.stack)
      log(err.stack)
    return []
  }
}

function getDiagnosticsTimerKey(doc: vscode.TextDocument) {
  return doc.uri.toString()
}

function scheduleDiagnosticsUpdate(doc: vscode.TextDocument) {
  const key = getDiagnosticsTimerKey(doc)
  const existingTimer = diagnosticsDebounceTimers.get(key)
  if (existingTimer)
    clearDiagnosticsTimer(key, existingTimer)
  diagnosticsDebounceTimers.set(key, setTimeout(() => {
    diagnosticsDebounceTimers.delete(key)
    updateDiagnostics(doc)
  }, 300))
}

function clearDiagnosticsTimer(key: string, timer = diagnosticsDebounceTimers.get(key)) {
  if (!timer)
    return
  clearTimeout(timer)
  if (diagnosticsDebounceTimers.get(key) === timer)
    diagnosticsDebounceTimers.delete(key)
}

function cancelDiagnosticsUpdate(doc: vscode.TextDocument) {
  clearDiagnosticsTimer(getDiagnosticsTimerKey(doc))
}

function flushDiagnosticsUpdate(doc: vscode.TextDocument) {
  cancelDiagnosticsUpdate(doc)
  updateDiagnostics(doc)
}

const IGNORE_DIRECTIVE_RE = /^\s*<!--\s*(?:markdown-auto-space|mas)-(?:disable-next-line|disable|enable)\s+(?:MAS\d{3}\s+)*(?:[A-Z0-9]*)$/

function completionRange(document: vscode.TextDocument, position: vscode.Position, start: number): vscode.Range {
  return new vscode.Range(new vscode.Position(position.line, start), position)
}

function getRuleCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
  if (document.languageId !== 'markdown')
    return []
  const before = document.lineAt(position.line).text.slice(0, position.character)
  const items: vscode.CompletionItem[] = []
  const directivePrefixMatch = /^\s*(<!--\s*(?:markdown-auto-space|mas)-)([a-z-]*)$/.exec(before)
  const directivePrefix = directivePrefixMatch !== null
  if (directivePrefix) {
    for (const kind of ['disable', 'enable', 'disable-next-line']) {
      const item = new vscode.CompletionItem(kind, vscode.CompletionItemKind.Keyword)
      item.insertText = kind
      item.range = completionRange(document, position, position.character - directivePrefixMatch![2]!.length)
      item.detail = 'Markdown Auto Space 局部忽略指令'
      item.documentation = new vscode.MarkdownString(kind === 'disable-next-line' ? '忽略下一行的规则。' : '开始或结束局部规则忽略。')
      items.push(item)
    }
  }
  if (!IGNORE_DIRECTIVE_RE.test(before))
    return items
  const ruleTokenMatch = /(?:^|\s)([A-Z0-9]*)$/.exec(before)
  const tokenStart = ruleTokenMatch ? before.length - ruleTokenMatch[1]!.length : position.character
  const existingCodes = new Set(before.match(/MAS\d{3}/g) ?? [])
  return items.concat(Object.values(RULE_DIAGNOSTIC_MAP).filter(rule => !existingCodes.has(rule.code)).map((rule) => {
    const item = new vscode.CompletionItem(rule.code, vscode.CompletionItemKind.Enum)
    item.range = completionRange(document, position, tokenStart)
    item.detail = rule.message
    item.documentation = new vscode.MarkdownString(`${rule.description}\n\n${rule.examples.map(([input, output]) => `\`${input}\` → \`${output}\``).join('\n\n')}`)
    return item
  }))
}

function getRuleHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
  if (document.languageId !== 'markdown')
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
    const end = start + codeMatch[0].length
    if (position.character >= start && position.character < end && start < directiveEnd) {
      ruleCode = codeMatch[0]
      break
    }
  }
  const rule = Object.values(RULE_DIAGNOSTIC_MAP).find(item => item.code === ruleCode)
  if (!rule)
    return undefined
  const markdown = new vscode.MarkdownString(`**${rule.code}：${rule.message}**\n\n${rule.description}\n\n${rule.examples.map(([input, output]) => `\`${input}\` → \`${output}\``).join('\n\n')}\n\n[查看完整规则文档](${getRuleDocUrl(rule.code)})`)
  return new vscode.Hover(markdown)
}

function refreshDiagnosticsForConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  const diagnosticsChanged = event.affectsConfiguration('markdownAutoSpace.diagnostics.enable')
  const rulesChanged = event.affectsConfiguration('markdownAutoSpace.rules')
  const excludeChanged = event.affectsConfiguration('markdownAutoSpace.exclude')
  if (!diagnosticsChanged && !rulesChanged && !excludeChanged)
    return

  const diagnosticsEnabled = vscode.workspace
    .getConfiguration('markdownAutoSpace')
    .get('diagnostics.enable') as boolean | undefined
  if (diagnosticsEnabled === false) {
    for (const timer of diagnosticsDebounceTimers.values())
      clearTimeout(timer)
    diagnosticsDebounceTimers.clear()
    diagnosticCollection.clear()
    return
  }

  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === 'markdown')
      flushDiagnosticsUpdate(doc)
  }
}

/**
 *
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Markdown Auto Space')
  statusBarItem = vscode.window.createStatusBarItem?.(vscode.StatusBarAlignment.Left, 100)
  if (statusBarItem)
    context.subscriptions.push(statusBarItem)
  log('Extension activated')

  const markdownAutoSpaceListener = vscode.commands.registerCommand('extension.markdownAutoSpace', async () => {
    log('Command: Format Document')
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      log('  No active editor')
      void vscode.window.showWarningMessage('Markdown Auto Space: Open a Markdown file before running this command.')
      return
    }

    const document = editor.document
    log(`  Document: ${document.uri.fsPath} languageId=${document.languageId}`)
    if (!shouldProcessFile(document)) {
      if (document.languageId === 'markdown' && isExcluded(document)) {
        log('  Skipped: current file is excluded')
        showStatus('Markdown Auto Space: Skipped excluded file.')
      }
      else {
        log('  Skipped: current file is not Markdown')
        void vscode.window.showWarningMessage(`Markdown Auto Space: Markdown files only (current language: ${document.languageId}).`)
      }
      return
    }

    const text = document.getText()
    const edits = getMarkdownAutoSpaceEdits(document, text)
    if (!edits?.length) {
      log('  No edits needed')
      showStatus('Markdown Auto Space: No changes needed.')
      return
    }

    const changeCount = getMarkdownAutoSpaceChangeCount(document, text)
    log(`  Applying ${changeCount} changes in ${edits.length} edits`)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(document.uri, edits)
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    log(`  applyEdit result: ${applied}`)
    updateDiagnostics(document)
    if (applied)
      showStatus(`Markdown Auto Space: Formatted document (${changeCount} changes).`)
  })
  context.subscriptions.push(markdownAutoSpaceListener)

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((event) => {
      const { formatOnSave } = getMarkdownAutoSpaceConfig(event.document)
      const runFormat = shouldRunFormatOnSave(event.reason)
      log(`onWillSave: ${event.document.uri.fsPath} formatOnSave=${formatOnSave} reason=${event.reason} runFormat=${runFormat}`)
      if (formatOnSave && runFormat)
        event.waitUntil(Promise.resolve(getFormatEdits(event.document)))
    }),
  )
  // 监听格式化文档命令
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('markdown', {
    provideDocumentFormattingEdits: (document) => {
      const { formatOnDocument } = getMarkdownAutoSpaceConfig(document)
      if (!formatOnDocument)
        return []

      const text = document.getText()
      return getMarkdownAutoSpaceEdits(document, text) ?? []
    },
  })
  context.subscriptions.push(formattingProvider)

  const registerCompletion = vscode.languages.registerCompletionItemProvider
  if (typeof registerCompletion === 'function') {
    context.subscriptions.push(registerCompletion.call(vscode.languages, 'markdown', {
      provideCompletionItems: getRuleCompletionItems,
    }, '<', '-', ' '))
  }
  const registerHover = vscode.languages.registerHoverProvider
  if (typeof registerHover === 'function') {
    context.subscriptions.push(registerHover.call(vscode.languages, 'markdown', {
      provideHover: getRuleHover,
    }))
  }

  // 诊断：在编辑器中标注违反「中英文加空格」规则的位置（类似 markdownlint）
  diagnosticCollection = vscode.languages.createDiagnosticCollection('markdown-auto-space')
  context.subscriptions.push(diagnosticCollection)

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      updateDiagnostics(doc)
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId !== 'markdown')
        return
      scheduleDiagnosticsUpdate(e.document)
    }),
    // Final refresh after save clears diagnostics left behind by save-time edits.
    vscode.workspace.onDidSaveTextDocument((doc) => {
      flushDiagnosticsUpdate(doc)
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      refreshDiagnosticsForConfigurationChange(event)
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      cancelDiagnosticsUpdate(doc)
      diagnosticCollection.delete(doc.uri)
    }),
  )
  // 已打开的文件初次诊断
  for (const doc of vscode.workspace.textDocuments)
    updateDiagnostics(doc)
}

/**
 *
 */
export function deactivate() {
  for (const timer of diagnosticsDebounceTimers.values())
    clearTimeout(timer)
  diagnosticsDebounceTimers.clear()
}
