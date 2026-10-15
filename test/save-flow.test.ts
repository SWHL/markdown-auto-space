/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'
import { activate, deactivate } from '../src/index'

const mock = vi.hoisted(() => {
  const events = {
    willSave: [] as Array<(event: any) => void>,
    didChange: [] as Array<(event: any) => void>,
    didSave: [] as Array<(document: any) => void>,
    didClose: [] as Array<(document: any) => void>,
    didOpen: [] as Array<(document: any) => void>,
    didChangeConfiguration: [] as Array<(event: any) => void>,
    didChangeActiveEditor: [] as Array<(editor: any) => void>,
  }
  const state = {
    formatOnSave: true,
    formatProviderEnabled: false,
    diagnosticsEnable: true,
    exclude: [] as string[],
    fileExtensions: ['.md'] as string[],
    providerRegistrations: [] as Array<{ kind: string, selector: any, dispose: ReturnType<typeof vi.fn> }>,
    textDocuments: [] as any[],
    applyEdit: vi.fn(async () => true),
    diagnosticSet: vi.fn(),
    diagnosticDelete: vi.fn(),
    diagnosticClear: vi.fn(),
    formattingProvider: undefined as any,
    codeActionProvider: undefined as any,
    commandId: undefined as string | undefined,
    commandIds: [] as string[],
    commandHandlers: new Map<string, any>(),
    executeCommand: vi.fn(),
    openedPreview: undefined as any,
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
  const providerRegistration = (kind: string, selector: any) => {
    const registration = { kind, selector, dispose: vi.fn() }
    mock.state.providerRegistrations.push(registration)
    return registration
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
      onDidChangeActiveTextEditor: register('didChangeActiveEditor'),
      createOutputChannel: () => ({ appendLine: vi.fn() }),
      activeTextEditor: undefined,
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
    },
    commands: {
      registerCommand: (id: string, handler: any) => {
        mock.state.commandId = id
        mock.state.commandIds.push(id)
        mock.state.commandHandlers.set(id, handler)
        return { dispose: vi.fn() }
      },
      executeCommand: mock.state.executeCommand,
    },
    languages: {
      match: () => mock.state.exclude.length ? 1 : 0,
      registerDocumentFormattingEditProvider: (_language: string, provider: any) => {
        mock.state.formattingProvider = provider
        return {
          dispose: vi.fn(() => {
            mock.state.formattingProvider = undefined
          }),
        }
      },
      registerCodeActionsProvider: (language: string, provider: any) => {
        mock.state.codeActionProvider = provider
        return providerRegistration('codeAction', language)
      },
      registerCompletionItemProvider: (language: string, provider: any) => {
        mock.state.completionProvider = provider
        return providerRegistration('completion', language)
      },
      registerHoverProvider: (language: string, provider: any) => {
        mock.state.hoverProvider = provider
        return providerRegistration('hover', language)
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
          if (key === 'formatProvider.enable')
            return mock.state.formatProviderEnabled
          if (key === 'diagnostics.enable')
            return mock.state.diagnosticsEnable
          if (key === 'exclude')
            return mock.state.exclude
          if (key === 'fileExtensions')
            return mock.state.fileExtensions
          return undefined
        },
      }),
      applyEdit: mock.state.applyEdit,
      openTextDocument: vi.fn(async (options: any) => {
        mock.state.openedPreview = options
        return {
          uri: { toString: () => 'untitled:markdown-auto-space-preview' },
        }
      }),
      onWillSaveTextDocument: register('willSave'),
      onDidChangeTextDocument: register('didChange'),
      onDidSaveTextDocument: register('didSave'),
      onDidCloseTextDocument: register('didClose'),
      onDidOpenTextDocument: register('didOpen'),
      onDidChangeConfiguration: register('didChangeConfiguration'),
    },
  }
})

function createDocument(uri = 'file:///test.md', text = '中文English', languageId = 'markdown') {
  const lines = text.split('\n')
  const lineOffsets = lines.map((_, index) => lines.slice(0, index).reduce((offset, line) => offset + line.length + 1, 0))
  return {
    languageId,
    uri: { fsPath: uri, toString: () => uri },
    lineCount: lines.length,
    getText: () => text,
    positionAt: (offset: number) => {
      const line = Math.max(0, lineOffsets.findLastIndex(start => start <= offset))
      return { line, character: offset - lineOffsets[line]! }
    },
    offsetAt: (position: { line: number, character: number }) => lineOffsets[position.line]! + position.character,
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
    mock.events.didChangeActiveEditor.length = 0
    mock.state.formatOnSave = true
    mock.state.formatProviderEnabled = false
    mock.state.diagnosticsEnable = true
    mock.state.exclude = []
    mock.state.fileExtensions = ['.md']
    mock.state.providerRegistrations.length = 0
    mock.state.textDocuments.length = 0
    mock.state.applyEdit.mockClear()
    mock.state.diagnosticSet.mockClear()
    mock.state.diagnosticDelete.mockClear()
    mock.state.diagnosticClear.mockClear()
    mock.state.completionProvider = undefined
    mock.state.hoverProvider = undefined
    mock.state.formattingProvider = undefined
    mock.state.codeActionProvider = undefined
    mock.state.commandId = undefined
    mock.state.commandIds.length = 0
    mock.state.commandHandlers.clear()
    mock.state.executeCommand.mockReset()
    mock.state.openedPreview = undefined
    ;(vscode as any).window.activeTextEditor = undefined
    ;(vscode as any).window.showInformationMessage.mockReset()
    activate({ subscriptions: [] } as any)
    mock.state.executeCommand.mockClear()
  })

  it('激活时注册 Markdown 格式化命令，provider 默认不注册', () => {
    expect(mock.state.commandIds).toContain('extension.markdownAutoSpace')
    expect(mock.state.commandIds).toContain('extension.markdownAutoSpacePreview')
    expect(mock.state.formattingProvider).toBeUndefined()
    expect(mock.state.codeActionProvider).toBeDefined()
  })

  it('菜单可见性跟随当前文件后缀配置', () => {
    const document = createDocument('file:///test.custom', '中文English', 'custom-markdown')
    ;(vscode as any).window.activeTextEditor = { document }
    mock.events.didChangeActiveEditor[0]!({ document })
    expect(mock.state.executeCommand).toHaveBeenLastCalledWith('setContext', 'markdownAutoSpace.supportedLanguage', false)

    mock.state.fileExtensions = ['.md', '.custom']
    mock.events.didChangeConfiguration[0]!({ affectsConfiguration: (key: string) => key === 'markdownAutoSpace.fileExtensions' })
    expect(mock.state.executeCommand).toHaveBeenLastCalledWith('setContext', 'markdownAutoSpace.supportedLanguage', true)

    ;(vscode as any).window.activeTextEditor = undefined
    mock.events.didChangeActiveEditor[0]!(undefined)
    expect(mock.state.executeCommand).toHaveBeenLastCalledWith('setContext', 'markdownAutoSpace.supportedLanguage', false)
  })

  it('provider 仅注册配置的后缀，配置变化释放旧注册，空列表禁用全部', () => {
    const initial = [...mock.state.providerRegistrations]
    expect(initial.map(item => [item.kind, item.selector])).toEqual([
      ['codeAction', { pattern: '**/*.[mM][dD]' }], ['completion', { pattern: '**/*.[mM][dD]' }], ['hover', { pattern: '**/*.[mM][dD]' }],
    ])
    mock.state.fileExtensions = ['.mdx', '.qmd', '.rmd']
    const event = { affectsConfiguration: (key: string) => key === 'markdownAutoSpace.fileExtensions' }
    mock.events.didChangeConfiguration[0]!(event)
    for (const registration of initial)
      expect(registration.dispose).toHaveBeenCalledTimes(1)
    const next = mock.state.providerRegistrations.slice(initial.length)
    for (const kind of ['codeAction', 'completion', 'hover']) {
      expect(next.filter(item => item.kind === kind).map(item => item.selector))
        .toEqual([{ pattern: '**/*.[mM][dD][xX]' }, { pattern: '**/*.[qQ][mM][dD]' }, { pattern: '**/*.[rR][mM][dD]' }])
    }
    mock.state.fileExtensions = []
    mock.events.didChangeConfiguration[0]!(event)
    for (const registration of next)
      expect(registration.dispose).toHaveBeenCalledTimes(1)
    expect(mock.state.providerRegistrations).toHaveLength(initial.length + next.length)
  })

  it('切换到已打开的其他后缀文档时刷新 provider 注册', () => {
    const initial = [...mock.state.providerRegistrations]
    mock.state.fileExtensions = ['.md', '.mdx']
    const document = createDocument('file:///test.mdx', '中文English', 'mdx')
    ;(vscode as any).window.activeTextEditor = { document }
    mock.events.didChangeActiveEditor[0]!({ document })

    for (const registration of initial)
      expect(registration.dispose).toHaveBeenCalledTimes(1)
    expect(mock.state.providerRegistrations.slice(initial.length).map(item => item.selector))
      .toEqual(Array(3).fill({ pattern: '**/*.[mM][dD]' }).concat(Array(3).fill({ pattern: '**/*.[mM][dD][xX]' })))
  })

  it('预览命令打开 diff 并确认后应用相同的最小范围编辑', async () => {
    const document = createDocument('file:///test.md', '中文English')
    mock.state.executeCommand.mockResolvedValue(undefined)
    ;(vscode as any).window.activeTextEditor = { document }
    ;(vscode as any).window.showInformationMessage.mockResolvedValue('Apply Changes')

    await mock.state.commandHandlers.get('extension.markdownAutoSpacePreview')!()

    expect(mock.state.openedPreview.content).toBe('中文 English')
    expect(mock.state.executeCommand).toHaveBeenCalledWith(
      'vscode.diff',
      document.uri,
      expect.anything(),
      expect.stringContaining('1 changes'),
    )
    expect(mock.state.applyEdit).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.any(Map) }))
  })

  it('取消预览不会应用编辑，无修改时不创建 diff', async () => {
    const document = createDocument('file:///test.md', '中文English')
    ;(vscode as any).window.activeTextEditor = { document }
    ;(vscode as any).window.showInformationMessage.mockResolvedValue('Cancel')
    await mock.state.commandHandlers.get('extension.markdownAutoSpacePreview')!()
    expect(mock.state.applyEdit).not.toHaveBeenCalled()
    expect(mock.state.executeCommand).toHaveBeenCalledTimes(1)

    mock.state.executeCommand.mockClear()
    mock.state.openedPreview = undefined
    ;(vscode as any).window.activeTextEditor = { document: createDocument('file:///test.md', '中文 English') }
    await mock.state.commandHandlers.get('extension.markdownAutoSpacePreview')!()
    expect(mock.state.openedPreview).toBeUndefined()
    expect(mock.state.executeCommand).not.toHaveBeenCalled()
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

  it('配置启用 mdx 后手动保存使用相同格式化流程', async () => {
    mock.state.fileExtensions = ['.md', '.mdx']
    const waits: Promise<readonly any[]>[] = []
    mock.events.willSave[0]!({
      document: createDocument('file:///test.mdx', '中文English', 'mdx'),
      reason: 1,
      waitUntil: (thenable: Promise<readonly any[]>) => waits.push(thenable),
    })
    expect(waits).toHaveLength(1)
    await expect(waits[0]).resolves.toEqual([expect.objectContaining({ newText: ' ' })])
  })

  it('MDX 保存、命令、provider 和诊断保护相同代码区域', async () => {
    mock.state.fileExtensions = ['.mdx']
    mock.state.formatProviderEnabled = true
    const document = createDocument('file:///test.mdx', 'export const 中文English = 1\n\n正文English {中文English}', 'mdx')
    ;(vscode as any).window.activeTextEditor = { document }
    mock.events.didChangeConfiguration[0]!({ affectsConfiguration: (key: string) => key.startsWith('markdownAutoSpace.') })
    const expected = mock.state.formattingProvider.provideDocumentFormattingEdits(document)
    expect(expected).toHaveLength(1)
    expect(expected[0].range.start.line).toBe(2)
    const waits: Promise<readonly any[]>[] = []
    mock.events.willSave[0]!({ document, reason: 1, waitUntil: (edits: Promise<readonly any[]>) => waits.push(edits) })
    await expect(waits[0]!).resolves.toEqual(expected)
    await mock.state.commandHandlers.get('extension.markdownAutoSpace')!()
    expect(mock.state.applyEdit).toHaveBeenCalledWith(expect.objectContaining({
      changes: new Map([[document.uri.toString(), expected]]),
    }))
    const diagnostics = mock.state.diagnosticSet.mock.calls.at(-1)![1]
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].range.start.line).toBe(2)
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

  it('切换 preset 时立即刷新所有已打开 Markdown 文档', () => {
    const document = createDocument()
    mock.state.textDocuments.push(document)
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.preset',
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
    mock.state.formatProviderEnabled = true
    mock.state.exclude = ['**/*.md']
    ;(vscode as any).window.activeTextEditor = { document: createDocument() }
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.formatProvider.enable',
    })
    expect(mock.state.formattingProvider.provideDocumentFormattingEdits(createDocument())).toEqual([])
  })

  it('标准 Format Document provider 默认不注册，开启后动态注册', () => {
    expect(mock.state.formattingProvider).toBeUndefined()
    ;(vscode as any).window.activeTextEditor = { document: createDocument() }
    mock.state.formatProviderEnabled = true
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.formatProvider.enable',
    })
    expect(mock.state.formattingProvider).toBeDefined()
  })

  it('关闭 provider 设置后释放标准格式化 provider', () => {
    ;(vscode as any).window.activeTextEditor = { document: createDocument() }
    mock.state.formatProviderEnabled = true
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.formatProvider.enable',
    })
    mock.state.formatProviderEnabled = false
    mock.events.didChangeConfiguration[0]!({
      affectsConfiguration: (key: string) => key === 'markdownAutoSpace.formatProvider.enable',
    })
    expect(mock.state.formattingProvider).toBeUndefined()
  })

  it('provider 关闭不影响扩展专用 Format Document 命令', async () => {
    const document = createDocument()
    ;(vscode as any).window.activeTextEditor = { document }
    await mock.state.commandHandlers.get('extension.markdownAutoSpace')!()
    expect(mock.state.applyEdit).toHaveBeenCalledWith(expect.objectContaining({ changes: expect.any(Map) }))
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
