import * as vscode from 'vscode'
import { getMarkdownAutoSpaceChangeCount, getMarkdownAutoSpaceConfig, getMarkdownAutoSpaceDiagnostics, getMarkdownAutoSpaceEdits } from './utils'
import { shouldRunFormatOnSave } from './type'

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
  if (doc.languageId !== 'markdown' || !diagnosticCollection)
    return
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

function refreshDiagnosticsForConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  const diagnosticsChanged = event.affectsConfiguration('markdownAutoSpace.diagnostics.enable')
  const rulesChanged = event.affectsConfiguration('markdownAutoSpace.rules')
  if (!diagnosticsChanged && !rulesChanged)
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
      log('  Skipped: current file is not Markdown')
      void vscode.window.showWarningMessage(`Markdown Auto Space: Markdown files only (current language: ${document.languageId}).`)
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
      const { formatOnSave } = getMarkdownAutoSpaceConfig()
      const runFormat = shouldRunFormatOnSave(event.reason)
      log(`onWillSave: ${event.document.uri.fsPath} formatOnSave=${formatOnSave} reason=${event.reason} runFormat=${runFormat}`)
      if (formatOnSave && runFormat)
        event.waitUntil(Promise.resolve(getFormatEdits(event.document)))
    }),
  )
  // 监听格式化文档命令
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('markdown', {
    provideDocumentFormattingEdits: (document) => {
      const { formatOnDocument } = getMarkdownAutoSpaceConfig()
      if (!formatOnDocument)
        return []

      const text = document.getText()
      return getMarkdownAutoSpaceEdits(document, text) ?? []
    },
  })
  context.subscriptions.push(formattingProvider)

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

/**
 * 仅对 Markdown 语言的文件处理
 * @param document
 */
function shouldProcessFile(document: vscode.TextDocument) {
  return document.languageId === 'markdown'
}
