import * as vscode from 'vscode'
import type { Disposable } from 'vscode'
import { getMarkdownAutoSpaceEdits, getMarkdownAutoSpaceConfig } from './utils'

let markdownAutoSpaceListener: Disposable
let configurationListener: Disposable
let outputChannel: vscode.OutputChannel

function log(msg: string) {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${msg}`)
}

/**
 * 对文档执行加空格并应用编辑（保存时或格式化时调用）
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
      return
    }

    const document = editor.document
    log(`  文档: ${document.uri.fsPath} languageId=${document.languageId}`)
    const text = document.getText()
    const edits = getMarkdownAutoSpaceEdits(document, text)
    if (!edits?.length) {
      log('  无编辑或无需修改')
      return
    }

    log(`  应用 ${edits.length} 处编辑`)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(document.uri, edits)
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    log(`  applyEdit 结果: ${applied}`)
  })
  context.subscriptions.push(markdownAutoSpaceListener)

  vscode.workspace.onWillSaveTextDocument((event) => {
    const { formatOnSave } = getMarkdownAutoSpaceConfig()
    log(`onWillSave: ${event.document.uri.fsPath} formatOnSave=${formatOnSave}`)
    if (formatOnSave)
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
}

/**
 *
 */
export function deactivate() {
  markdownAutoSpaceListener?.dispose()
  configurationListener?.dispose()
}

/** 仅对 Markdown 语言的文件处理 */
function shouldProcessFile(document: vscode.TextDocument) {
  return document.languageId === 'markdown'
}
