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
    didChangeConfiguration: [] as Array<(event: any) => void>,
  }
  const state = {
    formatOnSave: true,
    formatOnDocument: false,
    diagnosticsEnable: true,
    exclude: [] as string[],
    textDocuments: [] as any[],
    applyEdit: vi.fn(async () => true),
    diagnosticSet: vi.fn(),
    diagnosticDelete: vi.fn(),
    diagnosticClear: vi.fn(),
    formattingProvider: undefined as any,
    rangeFormattingProvider: undefined as any,
    codeActionProvider: undefined as any,
    commandId: undefined as string | undefined,
    completionProvider: undefined as any,
    hoverProvider: undefined as any,
  }
  return { events, state }
})

vi.mock('vscode', () => {
  class Range {
    constructor(public start: any, public end: any) { }
  }
  class TextEdit {
    constructor(public range: any, public newText: string) { }
    static replace(range: any, newText: string) {
      return new TextEdit(range, newText)
    }
  }
  class Diagnostic {
    constructor(public range: any, public message: string, public severity: number) { }
  }
  class Position {
    constructor(public line: number, public character: number) { }
  }
  class CompletionItem {
    insertText?: string
    range?: any
    detail?: string
    documentation?: any
    constructor(public label: string, public kind: number) { }
  }
  class MarkdownString {
    constructor(public value: string) { }
  }
  class Hover {
    constructor(public contents: any) { }
  }
  class WorkspaceEdit {
    changes = new Map<string, any[]>()
    set(uri: any, edits: any[]) {
      this.changes.set(typeof uri === 'string' ? uri : uri.toString(), edits)
    }
  }
  class CodeAction {
    diagnostics?: any[]
    edit?: any
    constructor(public title: string, public kind: any) { }
  }
  const codeActionKind = {
    QuickFix: 'quickfix',
    SourceFixAll: 'source.fixAll',
  }
  const register = (name: keyof typeof mock.events) => (listener: any) => {
    mock.events[name].push(listener)
    return { dispose: vi.fn() }
  }
  return {
    Diagnostic,
    Position,
    CompletionItem,
    MarkdownString,
    Hover,
    WorkspaceEdit,
    CodeAction,
    CodeActionKind: codeActionKind,
    CompletionItemKind: { Keyword: 1, Enum: 2 },
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
    commands: {
      registerCommand: (id: string) => {
        mock.state.commandId = id
        return { dispose: vi.fn() }
      },
    },
    languages: {
      match: () => mock.state.exclude.length ? 1 : 0,
      registerDocumentFormattingEditProvider: (_language: string, provider: any) => {
        mock.state.formattingProvider = provider
        return { dispose: vi.fn() }
      },
      registerDocumentRangeFormattingEditProvider: (_language: string, provider: any) => {
        mock.state.rangeFormattingProvider = provider
        return { dispose: vi.fn() }
      },
      registerCodeActionsProvider: (_language: string, provider: any) => {
        mock.state.codeActionProvider = provider
        return { dispose: vi.fn() }
      },
      registerCompletionItemProvider: (_language: string, provider: any) => {
        mock.state.completionProvider = provider
        return { dispose: vi.fn() }
      },
      registerHoverProvider: (_language: string, provider: any) => {
        mock.state.hoverProvider = provider
        return { dispose: vi.fn() }
      },
      createDiagnosticCollection: () => ({
        set: mock.state.diagnosticSet,
        delete: mock.state.diagnosticDelete,
        clear: mock.state.diagnosticClear,
        dispose: vi.fn(),
      }),
    },
    workspace: {
      textDocuments: mock.state.textDocuments,
      getWorkspaceFolder: () => undefined,
      getConfiguration: () => ({
        get: (key: string) => {
          if (key === 'formatOnSave')
            return mock.state.formatOnSave
          if (key === 'formatOnDocument')
            return mock.state.formatOnDocument
          if (key === 'diagnostics.enable')
            return mock.state.diagnosticsEnable
          if (key === 'exclude')
            return mock.state.exclude
          return undefined
        },
      }),
      applyEdit: mock.state.applyEdit,
      onWillSaveTextDocument: register('willSave'),
      onDidChangeTextDocument: register('didChange'),
      onDidSaveTextDocument: register('didSave'),
      onDidCloseTextDocument: register('didClose'),
      onDidOpenTextDocument: register('didOpen'),
      onDidChangeConfiguration: register('didChangeConfiguration'),
    },
  }
})

function createDocument(uri = 'file:///test.md', text = '中文English') {
  const lines = text.split('\n')
  const lineOffsets = lines.map((_, index) => lines.slice(0, index).reduce((offset, line) => offset + line.length + 1, 0))
  return {
    languageId: 'markdown',
    uri: { fsPath: uri, toString: () => uri },
    lineCount: lines.length,
    getText: () => text,
    positionAt: (offset: number) => {
      const line = Math.max(0, lineOffsets.findLastIndex(start => start <= offset))
      return { line, character: offset - lineOffsets[line]! }
    },
    lineAt: (line = 0) => ({
      text: lines[line]!,
      range: {
        start: {
          line,
          character: 0,
          translate: (lineDelta: number, character: number) => ({ line: line + lineDelta, character }),
        },
        end: { line, character: lines[line]!.length },
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
    mock.events.didChangeConfiguration.length = 0
    mock.state.formatOnSave = true
    mock.state.formatOnDocument = false
    mock.state.diagnosticsEnable = true
    mock.state.exclude = []
    mock.state.textDocuments.length = 0
    mock.state.applyEdit.mockClear()
    mock.state.diagnosticSet.mockClear()
    mock.state.diagnosticDelete.mockClear()
    mock.state.diagnosticClear.mockClear()
    mock.state.completionProvider = undefined
    mock.state.hoverProvider = undefined
    mock.state.rangeFormattingProvider = undefined
    mock.state.codeActionProvider = undefined
    mock.state.commandId = undefined
    activate({ subscriptions: [] } as any)
  })

  it('激活时注册 Markdown 格式化命令和 VS Code providers', () => {
    expect(mock.state.commandId).toBe('extension.markdownAutoSpace')
    expect(mock.state.formattingProvider).toBeDefined()
    expect(mock.state.rangeFormattingProvider).toBeDefined()
    expect(mock.state.codeActionProvider).toBeDefined()
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

  it('自动保存和失焦保存不调用 waitUntil', () => {
    const waitUntil = vi.fn()
    for (const reason of [2, 3])
      mock.events.willSave[0]!({ document: createDocument(), reason, waitUntil })
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it('只在忽略指令中提供指令和规则码补全', () => {
    const position = (character: number) => ({ line: 0, character })
    const doc = (text: string) => ({ ...createDocument('file:///test.md', text), lineAt: () => ({ text }) })
    expect(mock.state.completionProvider).toBeDefined()
    for (const text of ['普通文本 mas-disable MAS', '正文 <!-- mas-', '<!-- other --> mas-disable MAS'])
      expect(mock.state.completionProvider.provideCompletionItems(doc(text), position(text.length))).toEqual([])
    const directive = '<!-- mas-disable MAS'
    const items = mock.state.completionProvider.provideCompletionItems(doc(directive), position(directive.length))
    expect(items.some((item: any) => item.label === 'MAS001')).toBe(true)
    for (const prefix of ['<!-- mas-', '<!-- markdown-auto-space-']) {
      const candidates = mock.state.completionProvider.provideCompletionItems(doc(prefix), position(prefix.length))
      const item = candidates.find((candidate: any) => candidate.label === 'disable')
      const applied = prefix.slice(0, item.range.start.character) + item.insertText
      expect(applied).toBe(`${prefix}disable`)
    }
    const multi = '<!-- mas-disable MAS005 MAS'
    const candidates = mock.state.completionProvider.provideCompletionItems(doc(multi), position(multi.length))
    expect(candidates.some((item: any) => item.label === 'MAS009')).toBe(true)
    expect(candidates.some((item: any) => item.label === 'MAS005')).toBe(false)
  })

  it('只在规则码 token 上提供悬停说明', () => {
    const text = '<!-- mas-disable MAS005 MAS009 -->'
    const doc = { ...createDocument('file:///test.md', text), lineAt: () => ({ text }) }
    const mas005 = text.indexOf('MAS005') + 2
    const hover = mock.state.hoverProvider.provideHover(doc, { line: 0, character: mas005 })
    expect(hover.contents.value).toContain('MAS005')
    expect(mock.state.hoverProvider.provideHover(doc, { line: 0, character: 2 })).toBeUndefined()
    const second = mock.state.hoverProvider.provideHover(doc, { line: 0, character: text.indexOf('MAS009') + 3 })
    expect(second.contents.value).toContain('MAS009')
    for (const invalid of ['正文 mas-disable MAS005', '正文 <!-- mas-disable MAS005 -->', '<!-- mas-disable --> MAS005', '<!-- mas-disable XMAS005 -->']) {
      const invalidDoc = createDocument('file:///test.md', invalid)
      expect(mock.state.hoverProvider.provideHover(invalidDoc, { line: 0, character: invalid.indexOf('MAS005') + 2 })).toBeUndefined()
    }
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

  it('相关配置变化时立即刷新所有已打开 Markdown 文档', () => {
    const document = createDocument()
    mock.state.textDocuments.push(document)
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.rules',
    })
    expect(mock.state.diagnosticSet).toHaveBeenCalledWith(document.uri, expect.any(Array))
  })

  it('新增排除配置时立即删除已打开文档的诊断', () => {
    const document = createDocument()
    mock.state.textDocuments.push(document)
    mock.state.exclude = ['**/*.md']
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.exclude',
    })
    expect(mock.state.diagnosticDelete).toHaveBeenCalledWith(document.uri)
    expect(mock.state.diagnosticSet).not.toHaveBeenCalled()
  })

  it('标准 Format Document 提供器跳过排除文档', () => {
    mock.state.formatOnDocument = true
    mock.state.exclude = ['**/*.md']
    expect(mock.state.formattingProvider.provideDocumentFormattingEdits(createDocument())).toEqual([])
  })

  it('标准 Format Selection 只返回选区内的编辑', () => {
    mock.state.formatOnDocument = true
    const text = '中文English\n中文English'
    const document = createDocument('file:///test.md', text)
    const edits = mock.state.rangeFormattingProvider.provideDocumentRangeFormattingEdits(document, {
      start: { line: 1, character: 0 },
      end: { line: 1, character: text.length },
    })
    expect(edits).toHaveLength(1)
    expect(edits[0].range.start.line).toBe(1)
  })

  it('Quick Fix 只修复当前诊断，Fix All 修复全文', () => {
    const document = createDocument('file:///test.md', '中文English 中文English')
    const diagnostic = {
      source: 'markdown-auto-space',
      code: { value: 'MAS001' },
      range: { start: { line: 0, character: 2 }, end: { line: 0, character: 4 } },
    }
    const actions = mock.state.codeActionProvider.provideCodeActions(document, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    }, { diagnostics: [diagnostic] })
    expect(actions).toHaveLength(2)
    expect(actions[0].kind).toBe('quickfix')
    expect(actions[0].title).toContain('MAS001')
    expect(actions[1].kind).toBe('source.fixAll')
    expect(actions[0].edit.changes.get(document.uri.toString())).toHaveLength(1)
    expect(actions[1].edit.changes.get(document.uri.toString())).toHaveLength(2)
    expect(actions[0].edit.changes.get(document.uri.toString())[0].range.start.character).toBe(2)
  })

  it('只请求 Quick Fix 时不返回 Fix All', () => {
    const document = createDocument()
    const diagnostic = {
      source: 'markdown-auto-space',
      code: 'MAS001',
      range: { start: { line: 0, character: 2 }, end: { line: 0, character: 4 } },
    }
    const actions = mock.state.codeActionProvider.provideCodeActions(document, diagnostic.range, {
      diagnostics: [diagnostic],
      only: 'quickfix',
    })
    expect(actions.map((action: any) => action.kind)).toEqual(['quickfix'])
  })

  it('Fix All 在没有局部诊断时仍可返回', () => {
    const document = createDocument()
    const actions = mock.state.codeActionProvider.provideCodeActions(document, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    }, { diagnostics: [], only: 'source.fixAll' })
    expect(actions).toHaveLength(1)
    expect(actions[0].kind).toBe('source.fixAll')
  })

  it('关闭诊断时立即清空集合', () => {
    mock.state.diagnosticsEnable = false
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.diagnostics.enable',
    })
    expect(mock.state.diagnosticClear).toHaveBeenCalledTimes(1)
  })

  it('无关配置变化不会刷新诊断', () => {
    mock.state.diagnosticSet.mockClear()
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: () => false,
    })
    expect(mock.state.diagnosticSet).not.toHaveBeenCalled()
    expect(mock.state.diagnosticClear).not.toHaveBeenCalled()
  })
})
