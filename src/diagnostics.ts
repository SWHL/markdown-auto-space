import type * as vscode from 'vscode'
import { getMarkdownAutoSpaceDiagnostics, shouldProcessFile } from './utils'

/** Delay used to coalesce diagnostics while a document is being edited. */
export const DIAGNOSTICS_DEBOUNCE_MS = 300

export function createDiagnosticsController(collection: vscode.DiagnosticCollection) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const keyFor = (document: vscode.TextDocument) => document.uri.toString()

  const update = (document: vscode.TextDocument) => {
    if (!shouldProcessFile(document)) {
      collection.delete(document.uri)
      return
    }
    collection.set(document.uri, getMarkdownAutoSpaceDiagnostics(document, document.getText()))
  }

  const cancel = (document: vscode.TextDocument) => {
    const key = keyFor(document)
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }
  }

  const schedule = (document: vscode.TextDocument) => {
    cancel(document)
    const key = keyFor(document)
    timers.set(key, setTimeout(() => {
      timers.delete(key)
      update(document)
    }, DIAGNOSTICS_DEBOUNCE_MS))
  }

  const flush = (document: vscode.TextDocument) => {
    cancel(document)
    update(document)
  }

  const clear = () => {
    for (const timer of timers.values())
      clearTimeout(timer)
    timers.clear()
    collection.clear()
  }

  return { update, cancel, schedule, flush, clear }
}
