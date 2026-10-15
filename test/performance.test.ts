
/* eslint-disable @typescript-eslint/no-explicit-any, @stylistic/max-statements-per-line, @stylistic/space-in-parens, no-console */
import { performance } from 'node:perf_hooks'
import { describe, expect, it, vi } from 'vitest'
import { DIAGNOSTICS_DEBOUNCE_MS } from '../src/diagnostics'
import { protectMdxContent } from '../src/mdx'
import { getTextChangeCount } from '../src/utils'
import { processMarkdownContent } from '../src/markdownSpace'

vi.mock('vscode', () => {
  class Range { constructor(public start: any, public end: any) {} }
  class TextEdit { constructor(public range: any, public newText: string) {} static replace(r: any, t: string) { return new TextEdit(r, t) } }
  return {
    Diagnostic: class {}, DiagnosticSeverity: { Information: 1 }, Range, TextEdit,
    RelativePattern: class {}, Uri: { parse: (value: string) => value },
    languages: { match: () => 0 }, window: { activeTextEditor: undefined },
    workspace: { getWorkspaceFolder: () => undefined, getConfiguration: () => ({
      get: (key: string) => key === 'fileExtensions' ? ['.md'] : key === 'formatOnSave' ? true : key === 'diagnostics.enable' ? true : key === 'preset' ? 'default' : undefined,
    }) },
  }
})

const LINE_COUNT = 100_000
const FORMAT_MAX_MS = 5_000
const PROTECTION_MAX_MS = 2_000
const MEMORY_MAX_BYTES = 256 * 1024 * 1024

function makeLargeDocument() {
  return Array.from({ length: LINE_COUNT }, (_, index) => `这是第${index}行English100KB` ).join('\n')
}

describe('performance regressions', () => {
  it('keeps the 100k-line formatting benchmark within regression thresholds', () => {
    const source = makeLargeDocument()
    // Warm up the formatter, then use the median of several timing samples.
    processMarkdownContent(source)
    const samples = Array.from({ length: 3 }, () => {
      const started = performance.now()
      processMarkdownContent(source)
      return performance.now() - started
    })
    const elapsedMs = samples.sort((left, right) => left - right)[1]!
    // The memory sample performs exactly one formatting pass. Edit counting
    // consumes the already-produced output and never formats the source again.
    const before = process.memoryUsage().heapUsed
    const formatted = processMarkdownContent(source)
    const memoryDelta = Math.max(0, process.memoryUsage().heapUsed - before)
    const edits = getTextChangeCount(source, formatted)
    console.info(`[benchmark] format 100k lines: median=${elapsedMs.toFixed(1)} ms, edits=${edits}, heapDelta=${Math.round(memoryDelta / 1024 / 1024)} MiB`)
    expect(formatted.split('\n')).toHaveLength(LINE_COUNT)
    expect(edits).toBeGreaterThan(0)
    expect(elapsedMs).toBeLessThan(FORMAT_MAX_MS)
    expect(memoryDelta).toBeLessThan(MEMORY_MAX_BYTES)
  }, 20_000)

  it('keeps the large-document protection scan within its threshold', () => {
    const source = Array.from({ length: LINE_COUNT }, (_, index) => `export const row${index} = <Card title="中文English" />`).join('\n')
    const started = performance.now()
    const masked = protectMdxContent(source)
    const elapsedMs = performance.now() - started
    console.info(`[benchmark] MDX protection scan 100k lines: ${elapsedMs.toFixed(1)} ms`)
    expect(masked.text).toHaveLength(source.length)
    expect(elapsedMs).toBeLessThan(PROTECTION_MAX_MS)
  }, 20_000)

  it('keeps the diagnostics debounce contract explicit', () => {
    expect(DIAGNOSTICS_DEBOUNCE_MS).toBe(300)
  })
})
