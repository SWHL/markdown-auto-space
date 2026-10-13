/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activate, deactivate } from '../src/index'

const mock = vi.hoisted(() => {
  const events = {
    willSave: [] as Array<(event: any) => void>,
    didChange: [] as Array<(event: any) => void>,
    didSave: [] as Array<(document: any) => void>,
    didClose: [] as Array<(document: any) => void>,
    didOpen: [] as Array<(document: any) => void>,
  }
  const state = {
    formatOnSave: true,
    applyEdit: vi.fn(async () => true),
    diagnosticSet: vi.fn(),
    diagnosticDelete: vi.fn(),
  }
  return { events, state }
})

vi.mock('vscode', () => {
  class Range {
    constructor(public start: any, public end: any) {}
  }
  class TextEdit {
    constructor(public range: any, public newText: string) {}
    static replace(range: any, newText: string) {
      return new TextEdit(range, newText)
    }
  }
  class Diagnostic {
    constructor(public range: any, public message: string, public severity: number) {}
  }
  const register = (name: keyof typeof mock.events) => (listener: any) => {
    mock.events[name].push(listener)
    return { dispose: vi.fn() }
  }
  return {
    Diagnostic,
    DiagnosticSeverity: { Information: 1 },
    Range,
    TextEdit,
    Uri: { parse: (value: string) => value },
    window: {
      createOutputChannel: () => ({ appendLine: vi.fn() }),
      activeTextEditor: undefined,
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
    },
    commands: { registerCommand: () => ({ dispose: vi.fn() }) },
    languages: {
      registerDocumentFormattingEditProvider: () => ({ dispose: vi.fn() }),
      createDiagnosticCollection: () => ({
        set: mock.state.diagnosticSet,
        delete: mock.state.diagnosticDelete,
        dispose: vi.fn(),
      }),
    },
    workspace: {
      textDocuments: [],
      getConfiguration: () => ({
        get: (key: string) => {
          if (key === 'formatOnSave')
            return mock.state.formatOnSave
          if (key === 'formatOnDocument')
            return false
          if (key === 'diagnostics.enable')
            return true
          return undefined
        },
      }),
      applyEdit: mock.state.applyEdit,
      onWillSaveTextDocument: register('willSave'),
      onDidChangeTextDocument: register('didChange'),
      onDidSaveTextDocument: register('didSave'),
      onDidCloseTextDocument: register('didClose'),
      onDidOpenTextDocument: register('didOpen'),
    },
  }
})

function createDocument(uri = 'file:///test.md', text = '中文English') {
  return {
    languageId: 'markdown',
    uri: { fsPath: uri, toString: () => uri },
    lineCount: 1,
    getText: () => text,
    positionAt: (offset: number) => ({ line: 0, character: offset }),
    lineAt: () => ({
      text,
      range: {
        start: {
          line: 0,
          character: 0,
          translate: (line: number, character: number) => ({ line, character }),
        },
        end: { line: 0, character: text.length },
      },
    }),
  }
}

describe('save event flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mock.events.willSave.length = 0
    mock.events.didChange.length = 0
    mock.events.didSave.length = 0
    mock.events.didClose.length = 0
    mock.events.didOpen.length = 0
    mock.state.formatOnSave = true
    mock.state.applyEdit.mockClear()
    mock.state.diagnosticSet.mockClear()
    mock.state.diagnosticDelete.mockClear()
    activate({ subscriptions: [] } as any)
  })

  it('仅手动保存通过 waitUntil 返回 TextEdit，且保存流程不调用 applyEdit', async () => {
    const document = createDocument()
    const reasons = [1, 2, 3]
    const waits: Promise<readonly any[]>[] = []

    for (const reason of reasons) {
      mock.events.willSave[0]!({
        document,
        reason,
        waitUntil: (thenable: Promise<readonly any[]>) => waits.push(thenable),
      })
    }

    expect(waits).toHaveLength(1)
    await expect(waits[0]).resolves.toEqual([
      expect.objectContaining({ newText: ' ' }),
    ])
    expect(mock.state.applyEdit).not.toHaveBeenCalled()
  })

  it('formatOnSave 关闭时不会注册保存编辑', () => {
    mock.state.formatOnSave = false
    const waitUntil = vi.fn()
    mock.events.willSave[0]!({ document: createDocument(), reason: 1, waitUntil })
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('保存和关闭会取消待处理的诊断 debounce', () => {
    const document = createDocument()
    mock.events.didChange[0]!({ document })
    mock.events.didSave[0]!(document)
    const afterSave = mock.state.diagnosticSet.mock.calls.length
    vi.runAllTimers()
    expect(mock.state.diagnosticSet).toHaveBeenCalledTimes(afterSave)

    mock.events.didChange[0]!({ document })
    mock.events.didClose[0]!(document)
    vi.runAllTimers()
    expect(mock.state.diagnosticDelete).toHaveBeenCalledWith(document.uri)
    expect(mock.state.diagnosticSet).toHaveBeenCalledTimes(afterSave)
  })

  it('停用扩展时清理诊断 debounce', () => {
    const document = createDocument()
    mock.events.didChange[0]!({ document })
    deactivate()
    vi.runAllTimers()
    expect(mock.state.diagnosticSet).not.toHaveBeenCalled()
  })
})
