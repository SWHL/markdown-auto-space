import * as vscode from 'vscode'
import { getMarkdownAutoSpaceConfig, getMarkdownAutoSpaceDiagnostics, getMarkdownAutoSpaceEdits, getMarkdownAutoSpaceEditsForRange } from './utils'
import { shouldRunFormatOnSave } from './type'

let outputChannel: vscode.OutputChannel
let diagnosticCollection: vscode.DiagnosticCollection
const diagnosticsDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 *
 * @param msg
 */
function log(msg: string) {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${msg}`)
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
      log(`  跳过: 非 Markdown 文件`)
      return []
    }

    const text = document.getText()
    const edits = getMarkdownAutoSpaceEdits(document, text) ?? []
    if (!edits.length) {
      log(`  无编辑或无需修改`)
      return []
    }

    log(`  返回 ${edits.length} 处编辑供保存流程应用`)
    return edits
  }
  catch (err) {
    log(`  错误: ${err instanceof Error ? err.message : String(err)}`)
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

/**
 *
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Markdown Auto Space')
  log('扩展已激活')

  const markdownAutoSpaceListener = vscode.commands.registerCommand('extension.markdownAutoSpace', async () => {
    log('执行命令: Markdown Auto Space')
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      log('  无活动编辑器')
      void vscode.window.showWarningMessage('Markdown Auto Space: 请先打开一个 Markdown 文件再运行此命令。')
      return
    }

    const document = editor.document
    log(`  文档: ${document.uri.fsPath} languageId=${document.languageId}`)
    if (!shouldProcessFile(document)) {
      log('  跳过: 当前文件不是 Markdown')
      void vscode.window.showWarningMessage('Markdown Auto Space: 仅支持 Markdown 文件，当前为 ' + document.languageId + '。')
      return
    }

    const text = document.getText()
    const edits = getMarkdownAutoSpaceEdits(document, text)
    if (!edits?.length) {
      log('  无编辑或无需修改')
      void vscode.window.showInformationMessage('Markdown Auto Space: 当前文档无需修改。')
      return
    }

    log(`  应用 ${edits.length} 处编辑`)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(document.uri, edits)
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    log(`  applyEdit 结果: ${applied}`)
    updateDiagnostics(document)
    if (applied)
      void vscode.window.showInformationMessage(`Markdown Auto Space: 已应用 ${edits.length} 处修改。`)
  })
  context.subscriptions.push(markdownAutoSpaceListener)

  const formatSelectionListener = vscode.commands.registerCommand('extension.markdownAutoSpaceFormatSelection', async () => {
    log('执行命令: Markdown Auto Space 格式化选中')
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      log('  无活动编辑器')
      void vscode.window.showWarningMessage('Markdown Auto Space: 请先打开一个 Markdown 文件再运行此命令。')
      return
    }
    const document = editor.document
    if (!shouldProcessFile(document)) {
      log('  跳过: 当前文件不是 Markdown')
      void vscode.window.showWarningMessage('Markdown Auto Space: 仅支持 Markdown 文件。')
      return
    }
    const selection = editor.selection
    const rangeToFormat: vscode.Range = selection.isEmpty
      ? document.lineAt(selection.start.line).range
      : new vscode.Range(selection.start, selection.end)
    const edits = getMarkdownAutoSpaceEditsForRange(document, rangeToFormat)
    if (!edits?.length) {
      log('  选中内容无需修改')
      void vscode.window.showInformationMessage('Markdown Auto Space: 选中内容无需修改。')
      return
    }
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(document.uri, edits)
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    log(`  应用选中区编辑 结果: ${applied}`)
    updateDiagnostics(document)
    if (applied)
      void vscode.window.showInformationMessage('Markdown Auto Space: 已格式化选中内容。')
  })
  context.subscriptions.push(formatSelectionListener)

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
