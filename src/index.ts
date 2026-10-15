import * as vscode from 'vscode'
import { getMarkdownAutoSpaceChangeCount, getMarkdownAutoSpaceConfig, getMarkdownAutoSpaceEdits, getMarkdownAutoSpaceRuleHitCounts, isExcluded, isSupportedLanguage, shouldProcessFile } from './utils'
import { shouldRunFormatOnSave } from './type'
import { createDiagnosticsController } from './diagnostics'
import { getRuleCompletionItems, getRuleHover } from './ruleProviders'

let outputChannel: vscode.OutputChannel
let statusBarItem: vscode.StatusBarItem | undefined
let statusTimer: ReturnType<typeof setTimeout> | undefined
let diagnostics: ReturnType<typeof createDiagnosticsController>

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

function rangesOverlap(left: vscode.Range, right: vscode.Range): boolean {
  const startsBeforeEnd = left.start.line < right.end.line
    || (left.start.line === right.end.line && left.start.character <= right.end.character)
  const endsAfterStart = left.end.line > right.start.line
    || (left.end.line === right.start.line && left.end.character >= right.start.character)
  return startsBeforeEnd && endsAfterStart
}

function applyTextEdits(document: vscode.TextDocument, text: string, edits: vscode.TextEdit[]): string {
  return [...edits]
    .map(edit => ({
      start: document.offsetAt(edit.range.start),
      end: document.offsetAt(edit.range.end),
      newText: edit.newText,
    }))
    .sort((left, right) => right.start - left.start)
    .reduce((result, edit) => result.slice(0, edit.start) + edit.newText + result.slice(edit.end), text)
}

function formatRuleSummary(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${code}: ${count}`)
    .join(', ')
}

function codeActionKindRequested(only: vscode.CodeActionKind | undefined, kind: vscode.CodeActionKind): boolean {
  if (!only)
    return true
  return only.contains ? only.contains(kind) : only === kind
}

function refreshDiagnosticsForConfigurationChange(event: vscode.ConfigurationChangeEvent) {
  const diagnosticsChanged = event.affectsConfiguration('markdownAutoSpace.diagnostics.enable')
  const presetChanged = event.affectsConfiguration('markdownAutoSpace.preset')
  const rulesChanged = event.affectsConfiguration('markdownAutoSpace.rules')
  const unitsChanged = event.affectsConfiguration('markdownAutoSpace.units')
  const excludeChanged = event.affectsConfiguration('markdownAutoSpace.exclude')
  const languageIdsChanged = event.affectsConfiguration('markdownAutoSpace.languageIds')
  if (!diagnosticsChanged && !presetChanged && !rulesChanged && !unitsChanged && !excludeChanged && !languageIdsChanged)
    return

  const diagnosticsEnabled = vscode.workspace
    .getConfiguration('markdownAutoSpace')
    .get('diagnostics.enable') as boolean | undefined
  if (diagnosticsEnabled === false) {
    diagnostics.clear()
    return
  }

  for (const doc of vscode.workspace.textDocuments)
    diagnostics.flush(doc)
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

  const refreshCommandContext = () => {
    const document = vscode.window.activeTextEditor?.document
    void vscode.commands.executeCommand('setContext', 'markdownAutoSpace.supportedLanguage', !!document && isSupportedLanguage(document))
  }
  refreshCommandContext()

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
      if (isSupportedLanguage(document) && isExcluded(document)) {
        log('  Skipped: current file is excluded')
        showStatus('Markdown Auto Space: Skipped excluded file.')
      }
      else {
        log('  Skipped: current language is not configured')
        void vscode.window.showWarningMessage(`Markdown Auto Space: Language '${document.languageId}' is not enabled in markdownAutoSpace.languageIds.`)
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
    diagnostics.update(document)
    if (applied)
      showStatus(`Markdown Auto Space: Formatted document (${changeCount} changes).`)
  })
  context.subscriptions.push(markdownAutoSpaceListener)

  const previewCommand = vscode.commands.registerCommand('extension.markdownAutoSpacePreview', async () => {
    log('Command: Preview Changes')
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      void vscode.window.showWarningMessage('Markdown Auto Space: Open a Markdown file before previewing changes.')
      return
    }

    const document = editor.document
    if (!shouldProcessFile(document)) {
      if (isSupportedLanguage(document) && isExcluded(document))
        showStatus('Markdown Auto Space: Skipped excluded file.')
      else
        void vscode.window.showWarningMessage(`Markdown Auto Space: Language '${document.languageId}' is not enabled in markdownAutoSpace.languageIds.`)
      return
    }

    const originalText = document.getText()
    const originalVersion = document.version
    const edits = getMarkdownAutoSpaceEdits(document, originalText) ?? []
    if (!edits.length) {
      showStatus('Markdown Auto Space: No changes needed.')
      return
    }

    const changeCount = getMarkdownAutoSpaceChangeCount(document, originalText)
    const ruleSummary = formatRuleSummary(getMarkdownAutoSpaceRuleHitCounts(document, originalText))
    const previewText = applyTextEdits(document, originalText, edits)
    const previewDocument = await vscode.workspace.openTextDocument({ content: previewText, language: document.languageId })
    await vscode.commands.executeCommand(
      'vscode.diff',
      document.uri,
      previewDocument.uri,
      `Markdown Auto Space: Preview (${changeCount} changes)`,
    )

    const summary = ruleSummary
      ? `Markdown Auto Space: ${changeCount} changes pending (${ruleSummary}). Apply changes?`
      : `Markdown Auto Space: ${changeCount} changes pending. Apply changes?`
    const choice = await vscode.window.showInformationMessage(summary, 'Apply Changes', 'Cancel')
    if (choice !== 'Apply Changes') {
      log('  Preview cancelled')
      return
    }
    if (typeof originalVersion === 'number' && document.version !== originalVersion) {
      void vscode.window.showWarningMessage('Markdown Auto Space: The document changed while the preview was open; no changes were applied.')
      return
    }

    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.set(document.uri, edits)
    const applied = await vscode.workspace.applyEdit(workspaceEdit)
    log(`  Preview applyEdit result: ${applied}`)
    if (applied) {
      diagnostics.update(document)
      showStatus(`Markdown Auto Space: Formatted document (${changeCount} changes).`)
    }
  })
  context.subscriptions.push(previewCommand)

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((event) => {
      const { formatOnSave } = getMarkdownAutoSpaceConfig(event.document)
      const runFormat = shouldRunFormatOnSave(event.reason)
      log(`onWillSave: ${event.document.uri.fsPath} formatOnSave=${formatOnSave} reason=${event.reason} runFormat=${runFormat}`)
      if (formatOnSave && runFormat)
        event.waitUntil(Promise.resolve(getFormatEdits(event.document)))
    }),
  )
  // Only register the standard providers when enabled. A registered provider
  // that returns [] can otherwise win provider selection while appearing to do
  // nothing, and can prevent another Markdown formatter from being selected.
  let formattingProviders: vscode.Disposable[] = []
  let providerLanguageIds: string[] = []
  const getProviderDocuments = (document?: vscode.TextDocument) => {
    const documents = [...vscode.workspace.textDocuments]
    if (document && !documents.includes(document))
      documents.push(document)
    return documents
  }
  const getProviderLanguageIds = (document?: vscode.TextDocument) => {
    const documents = getProviderDocuments(document)
    const configs = documents.length > 0
      ? documents.map(target => getMarkdownAutoSpaceConfig(target))
      : [getMarkdownAutoSpaceConfig()]
    return [...new Set(configs.flatMap(config => config.languageIds))]
  }
  const disposeFormattingProviders = () => {
    formattingProviders.forEach(provider => provider.dispose())
    formattingProviders = []
    providerLanguageIds = []
  }
  const refreshFormattingProviders = (document?: vscode.TextDocument) => {
    const documents = getProviderDocuments(document)
    const enabled = documents.length > 0
      ? documents.some(target => getMarkdownAutoSpaceConfig(target).formatProviderEnabled)
      : getMarkdownAutoSpaceConfig().formatProviderEnabled
    if (!enabled) {
      disposeFormattingProviders()
      return
    }
    const languageIds = getProviderLanguageIds(document)
    if (providerLanguageIds.join('\0') === languageIds.join('\0'))
      return
    disposeFormattingProviders()
    providerLanguageIds = languageIds
    formattingProviders = languageIds.map(languageId => vscode.languages.registerDocumentFormattingEditProvider(languageId, {
      provideDocumentFormattingEdits: (target) => {
        if (!getMarkdownAutoSpaceConfig(target).formatProviderEnabled)
          return []
        return getMarkdownAutoSpaceEdits(target, target.getText()) ?? []
      },
    }))
  }
  refreshFormattingProviders(vscode.window.activeTextEditor?.document)
  context.subscriptions.push({ dispose: disposeFormattingProviders })

  const codeActionProvider: vscode.CodeActionProvider = {
    provideCodeActions: (document, _range, context) => {
      if (!shouldProcessFile(document))
        return []

      const edits = getFormatEdits(document)
      if (!edits.length)
        return []

      const actions: vscode.CodeAction[] = codeActionKindRequested(context.only, vscode.CodeActionKind.QuickFix)
        ? context.diagnostics
          .filter(diagnostic => diagnostic.source === 'markdown-auto-space')
          .map((diagnostic) => {
            const code = typeof diagnostic.code === 'object' && diagnostic.code
              ? diagnostic.code.value
              : diagnostic.code
            const action = new vscode.CodeAction(`Fix ${String(code ?? 'Markdown Auto Space')}`, vscode.CodeActionKind.QuickFix)
            action.diagnostics = [diagnostic]
            const edit = new vscode.WorkspaceEdit()
            edit.set(document.uri, edits.filter(edit => rangesOverlap(edit.range, diagnostic.range)))
            action.edit = edit
            return action
          })
        : []

      if (codeActionKindRequested(context.only, vscode.CodeActionKind.SourceFixAll)) {
        const fixAll = new vscode.CodeAction('Fix all Markdown Auto Space issues', vscode.CodeActionKind.SourceFixAll)
        const edit = new vscode.WorkspaceEdit()
        edit.set(document.uri, edits)
        fixAll.edit = edit
        actions.push(fixAll)
      }
      return actions
    },
  }
  const providerDisposables: vscode.Disposable[] = []
  const registerLanguageProviders = (document?: vscode.TextDocument) => {
    providerDisposables.splice(0).forEach(provider => provider.dispose())
    const languageIds = getProviderLanguageIds(document)
    for (const languageId of languageIds) {
      providerDisposables.push(vscode.languages.registerCodeActionsProvider(languageId, codeActionProvider, {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.SourceFixAll],
      }))
      if (typeof vscode.languages.registerCompletionItemProvider === 'function')
        providerDisposables.push(vscode.languages.registerCompletionItemProvider(languageId, { provideCompletionItems: getRuleCompletionItems }, '<', '-', ' '))
      if (typeof vscode.languages.registerHoverProvider === 'function')
        providerDisposables.push(vscode.languages.registerHoverProvider(languageId, { provideHover: getRuleHover }))
    }
  }
  registerLanguageProviders(vscode.window.activeTextEditor?.document)
  context.subscriptions.push({ dispose: () => providerDisposables.splice(0).forEach(provider => provider.dispose()) })
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
    refreshCommandContext()
    registerLanguageProviders(editor?.document)
    refreshFormattingProviders(editor?.document)
  }))

  // 诊断：在编辑器中标注违反「中英文加空格」规则的位置（类似 markdownlint）
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('markdown-auto-space')
  diagnostics = createDiagnosticsController(diagnosticCollection)
  context.subscriptions.push(diagnosticCollection)

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      refreshCommandContext()
      registerLanguageProviders(doc)
      refreshFormattingProviders(doc)
      diagnostics.update(doc)
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!isSupportedLanguage(e.document))
        return
      diagnostics.schedule(e.document)
    }),
    // Final refresh after save clears diagnostics left behind by save-time edits.
    vscode.workspace.onDidSaveTextDocument((doc) => {
      diagnostics.flush(doc)
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('markdownAutoSpace.languageIds')) {
        refreshCommandContext()
        registerLanguageProviders(vscode.window.activeTextEditor?.document)
      }
      if (event.affectsConfiguration('markdownAutoSpace.formatProvider.enable')
        || event.affectsConfiguration('markdownAutoSpace.languageIds'))
        refreshFormattingProviders(vscode.window.activeTextEditor?.document)
      refreshDiagnosticsForConfigurationChange(event)
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.cancel(doc)
      diagnosticCollection.delete(doc.uri)
      const activeDocument = vscode.window.activeTextEditor?.document
      registerLanguageProviders(activeDocument)
      refreshFormattingProviders(activeDocument)
    }),
  )
  // 已打开的文件初次诊断
  for (const doc of vscode.workspace.textDocuments)
    diagnostics.update(doc)
}

/**
 *
 */
export function deactivate() {
  diagnostics?.clear()
}
