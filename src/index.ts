import * as vscode from 'vscode'
import type { Disposable } from 'vscode'
import { getMarkdownAutoSpaceConfig, getMarkdownAutoSpaceDiagnostics, getMarkdownAutoSpaceEdits, getMarkdownAutoSpaceEditsForRange } from './utils'
import { shouldRunFormatOnSave } from './type'

let markdownAutoSpaceListener: Disposable
let configurationListener: Disposable
let outputChannel: vscode.OutputChannel
let diagnosticCollection: vscode.DiagnosticCollection
let diagnosticsDebounceTimer: ReturnType<typeof setTimeout> | undefined

/**
 *
 * @param msg
 */
function log(msg: string) {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${msg}`)
}

/**
 * 对文档执行加空格并应用编辑（保存时或格式化时调用）
 * @param document
 */
async function formatDocument(document: vscode.TextDocument) {
  try {
    log(`formatDocument: ${document.uri.fsPath} languageId=${document.languageId}`)
    if (!shouldProcessFile(document)) {
      log(`  跳过: 非 Markdown 文件`)
      return
    }

    const text = document.getText()
    const edits = getMarkdownAutoSpaceEdits(document, text)
    if (!edits?.length) {
      log(`  无编辑或无需修改`)
      return
    }

    log(`  应用 ${edits.length} 处编辑`)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(document.uri, edits)
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    log(`  applyEdit 结果: ${applied}`)
  }
  catch (err) {
    log(`  错误: ${err instanceof Error ? err.message : String(err)}`)
    if (err instanceof Error && err.stack)
      log(err.stack)
  }
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
    if (applied)
      void vscode.window.showInformationMessage('Markdown Auto Space: 已格式化选中内容。')
  })
  context.subscriptions.push(formatSelectionListener)

  vscode.workspace.onWillSaveTextDocument((event) => {
    const { formatOnSave } = getMarkdownAutoSpaceConfig()
    const runFormat = shouldRunFormatOnSave(event.reason)
    log(`onWillSave: ${event.document.uri.fsPath} formatOnSave=${formatOnSave} reason=${event.reason} runFormat=${runFormat}`)
    if (formatOnSave && runFormat)
      event.waitUntil(formatDocument(event.document))
  })
  // 监听格式化文档命令
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider('markdown', {
    provideDocumentFormattingEdits: (document) => {
      const { formatOnDocument } = getMarkdownAutoSpaceConfig()
      if (!formatOnDocument || !isFormatDocumentCommand())
        return []

      const text = document.getText()
      return getMarkdownAutoSpaceEdits(document, text) ?? []
    },
  })
  context.subscriptions.push(formattingProvider)
  // 全局变量来跟踪当前操作
  let isFormatDocumentCommandActive = false
  // 注册一个命令来设置标志
  const formatDocumentCommand = vscode.commands.registerCommand('editor.action.formatDocument', async () => {
    isFormatDocumentCommandActive = true
    try {
      await vscode.commands.executeCommand('editor.action.formatDocument.multiple')
    }
    finally {
      isFormatDocumentCommandActive = false
    }
  })

  /**
   *
   */
  function isFormatDocumentCommand() {
    return isFormatDocumentCommandActive
  }

  // 在 activate 函数中添加这个命令
  context.subscriptions.push(formatDocumentCommand)

  // 诊断：在编辑器中标注违反「中英文加空格」规则的位置（类似 markdownlint）
  diagnosticCollection = vscode.languages.createDiagnosticCollection('markdown-auto-space')
  context.subscriptions.push(diagnosticCollection)

  /**
   *
   * @param doc
   */
  function updateDiagnostics(doc: vscode.TextDocument) {
    if (doc.languageId !== 'markdown')
      return
    const diagnostics = getMarkdownAutoSpaceDiagnostics(doc, doc.getText())
    diagnosticCollection.set(doc.uri, diagnostics)
  }

  vscode.workspace.onDidOpenTextDocument((doc) => {
    updateDiagnostics(doc)
  })
  vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.languageId !== 'markdown')
      return
    if (diagnosticsDebounceTimer)
      clearTimeout(diagnosticsDebounceTimer)
    diagnosticsDebounceTimer = setTimeout(() => {
      diagnosticsDebounceTimer = undefined
      updateDiagnostics(e.document)
    }, 300)
  })
  vscode.workspace.onDidCloseTextDocument((doc) => {
    diagnosticCollection.delete(doc.uri)
  })
  // 已打开的文件初次诊断
  for (const doc of vscode.workspace.textDocuments)
    updateDiagnostics(doc)
}

/**
 *
 */
export function deactivate() {
  markdownAutoSpaceListener?.dispose()
  configurationListener?.dispose()
}

/**
 * 仅对 Markdown 语言的文件处理
 * @param document
 */
function shouldProcessFile(document: vscode.TextDocument) {
  return document.languageId === 'markdown'
}
