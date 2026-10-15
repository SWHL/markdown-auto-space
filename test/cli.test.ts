import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'
import { formatMarkdownText } from '../src/core'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'markdown-auto-space-'))
  await mkdir(join(root, 'docs'))
  return root
}

describe('CLI', () => {
  it('formats a single file and --check returns non-zero until it is written', async () => {
    const root = await fixture()
    const file = join(root, 'docs', 'readme.md')
    await writeFile(file, '中文English')
    expect(await runCli(['--check', file])).toBe(1)
    expect(await runCli(['--write', file])).toBe(0)
    expect(await readFile(file, 'utf8')).toBe(formatMarkdownText('中文English'))
    expect(await runCli(['--check', file])).toBe(0)
  })

  it('supports directories, globs, excludes and JSON configuration', async () => {
    const root = await fixture()
    const first = join(root, 'docs', 'one.md')
    const second = join(root, 'docs', 'two.md')
    const ignored = join(root, 'docs', 'ignored.md')
    await writeFile(first, '中文English')
    await writeFile(second, '速度10rpm')
    await writeFile(ignored, '中文English')
    const config = join(root, 'config.json')
    await writeFile(config, JSON.stringify({ rules: { MAS001: false }, units: { additional: ['rpm'] }, exclude: ['docs/ignored.md'] }))
    expect(await runCli(['--write', '--config', config, join(root, 'docs', '*.md')])).toBe(0)
    expect(await readFile(first, 'utf8')).toBe('中文English')
    expect(await readFile(second, 'utf8')).toBe('速度10 rpm')
    expect(await readFile(ignored, 'utf8')).toBe('中文English')
  })

  it('matches globstar files directly under and below the directory', async () => {
    const root = await fixture()
    const direct = join(root, 'docs', 'direct.md')
    const nested = join(root, 'docs', 'nested', 'deep.md')
    await mkdir(join(root, 'docs', 'nested'))
    await writeFile(direct, '中文English')
    await writeFile(nested, '中文English')
    expect(await runCli(['--write', join(root, 'docs', '**', '*.md')])).toBe(0)
    expect(await readFile(direct, 'utf8')).toBe('中文 English')
    expect(await readFile(nested, 'utf8')).toBe('中文 English')
  })

  it('prints a diff and uses the shared core output', async () => {
    const root = await fixture()
    const file = join(root, 'sample.md')
    await writeFile(file, '中文English\n')
    const originalWrite = process.stdout.write
    let output = ''
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk)
      return true
    }) as typeof process.stdout.write
    try {
      expect(await runCli(['--diff', file])).toBe(1)
    }
    finally {
      process.stdout.write = originalWrite
    }
    expect(output).toContain('-中文English')
    expect(output).toContain(`+${formatMarkdownText('中文English')}`)
  })
})
