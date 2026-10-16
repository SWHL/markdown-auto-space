#!/usr/bin/env node
/* eslint-disable @stylistic/max-statements-per-line, no-useless-escape */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { formatMarkdownText } from './core'
import { getMarkdownSpaceViolations } from './markdownSpace'
import { normalizeRules } from './type'
import type { DigitUnitOptions } from './markdownSpace'
import type { MarkdownAutoSpacePreset } from './type'

interface CliConfig {
  preset?: MarkdownAutoSpacePreset
  rules?: Record<string, boolean>
  units?: DigitUnitOptions
  exclude?: string[]
  fileExtensions?: string[]
}

interface CliOptions {
  inputs: string[]
  write: boolean
  check: boolean
  diff: boolean
  changed: boolean
  staged: boolean
  config?: string
}

const DEFAULT_EXTENSIONS = ['.md']

function usage(): string {
  return `Usage: markdown-auto-space [options] <file|directory|glob ...>

Options:
  --write                 Write formatted text back to files
  --check                 Exit 1 when any file would change
  --diff                  Print unified diffs (implies --check when --write is absent)
  --changed               Check only files changed in the working tree
  --staged                Check only files staged for commit (implies --changed)
  --config <file>         Read a JSON configuration file
  -h, --help              Show this help

Configuration keys match VS Code settings: preset, rules, units, exclude, fileExtensions.
`
}

function parseArgs(argv: string[]): CliOptions {
  const inputs: string[] = []
  let write = false
  let check = false
  let diff = false
  let changed = false
  let staged = false
  let config: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--write') { write = true }
    else if (arg === '--check') { check = true }
    else if (arg === '--diff') { diff = true }
    else if (arg === '--changed') { changed = true }
    else if (arg === '--staged') { staged = true; changed = true }
    else if (arg === '--config') { config = argv[++i] }
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write(usage())
      process.exit(0)
    }
    else if (arg.startsWith('-')) { throw new Error(`Unknown option: ${arg}`) }
    else { inputs.push(arg) }
  }
  if (!inputs.length && !changed) throw new Error('At least one file, directory, or glob is required (or use --changed).')
  return { inputs, write, check: check || (diff && !write) || changed, diff, changed, staged, config }
}

const execFileAsync = promisify(execFile)

async function changedFiles(staged: boolean): Promise<string[]> {
  const args = ['diff', '--name-only', '-z', '--diff-filter=ACMR']
  if (staged) args.push('--cached')
  const { stdout } = await execFileAsync('git', args, { cwd: process.cwd(), encoding: 'buffer' })
  return stdout.toString('utf8').split('\0').filter(Boolean)
}

async function readInputFile(file: string, staged: boolean): Promise<string> {
  if (!staged)
    return readFile(file, 'utf8')
  const repoPath = relative(process.cwd(), file).split(sep).join('/')
  const { stdout } = await execFileAsync('git', ['show', `:${repoPath}`], { cwd: process.cwd(), encoding: 'utf8' })
  return stdout
}

function parseConfig(text: string, path: string): CliConfig {
  try {
    return JSON.parse(text) as CliConfig
  }
  catch (error) {
    throw new Error(`Invalid JSON config ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function loadConfig(explicitPath?: string): Promise<{ config: CliConfig, baseDir: string }> {
  const path = explicitPath
    ? resolve(explicitPath)
    : ['.markdown-auto-space.json', 'markdown-auto-space.config.json']
        .map(name => resolve(name)).find(candidate => existsSync(candidate))
  if (!path) return { config: {}, baseDir: process.cwd() }
  return { config: parseConfig(await readFile(path, 'utf8'), path), baseDir: dirname(path) }
}

function normalizeExtensions(config: CliConfig): string[] {
  const values = Array.isArray(config.fileExtensions) ? config.fileExtensions : DEFAULT_EXTENSIONS
  const extensions = values.filter((value): value is string => typeof value === 'string')
    .map(value => value.startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`)
    .filter(value => /^\.[a-z0-9][a-z0-9._-]*$/.test(value))
  return [...new Set(extensions.length ? extensions : DEFAULT_EXTENSIONS)]
}

function hasMagic(value: string): boolean { return /[*?[]/.test(value) }

function globRegExp(pattern: string): RegExp {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        i++
        if (pattern[i + 1] === '/') {
          source += '(?:.*/)?'
          i++
        }
        else {
          source += '.*'
        }
      }
      else { source += '[^/]*' }
    }
    else if (char === '?') { source += '[^/]' }
    else { source += /[.+^${}()|\\]/.test(char) ? `\\${char}` : char === '[' ? '\\[' : char }
  }
  return new RegExp(`^${source}$`, 'i')
}

function matchesGlob(path: string, pattern: string): boolean {
  const normalized = path.split(sep).join('/')
  const candidate = pattern.split(sep).join('/')
  return globRegExp(candidate.replace(/^\.\//, '')).test(normalized)
}

async function walkDirectory(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) files.push(...await walkDirectory(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

async function resolveInputs(inputs: string[], extensions: string[], baseDir: string): Promise<string[]> {
  const files = new Set<string>()
  for (const input of inputs) {
    const absolute = resolve(baseDir, input)
    if (!hasMagic(input) && existsSync(absolute)) {
      const info = await stat(absolute)
      const candidates = info.isDirectory() ? await walkDirectory(absolute) : [absolute]
      for (const file of candidates) if (extensions.includes(extname(file).toLowerCase())) files.add(file)
      continue
    }
    const magicIndex = input.search(/[\*?[]/)
    const staticPrefix = input.slice(0, magicIndex)
    const root = staticPrefix.slice(0, Math.max(staticPrefix.lastIndexOf('/'), staticPrefix.lastIndexOf('\\')) + 1) || '.'
    const candidates = await walkDirectory(isAbsolute(input) ? resolve(root) : resolve(baseDir, root)).catch(() => [])
    for (const file of candidates) {
      const relativePath = relative(baseDir, file).split(sep).join('/')
      const targetPath = isAbsolute(input) ? file.split(sep).join('/') : relativePath
      if (matchesGlob(targetPath, input) && extensions.includes(extname(file).toLowerCase())) files.add(file)
    }
  }
  return [...files].sort()
}

function excluded(file: string, baseDir: string, patterns: string[] = []): boolean {
  const relativePath = relative(baseDir, file).split(sep).join('/')
  return patterns.some(pattern => pattern.trim() && matchesGlob(relativePath, pattern))
}

function unifiedDiff(file: string, before: string, after: string): string {
  const oldLines = before.split(/\r?\n/)
  const newLines = after.split(/\r?\n/)
  const output = [`--- ${file}`, `+++ ${file}`]
  const count = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < count; i++) {
    if (oldLines[i] === newLines[i]) continue
    if (oldLines[i] !== undefined) output.push(`-${oldLines[i]}`)
    if (newLines[i] !== undefined) output.push(`+${newLines[i]}`)
  }
  return `${output.join('\n')}\n`
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(argv)
  const { config, baseDir } = await loadConfig(options.config)
  const inputPaths = options.changed ? await changedFiles(options.staged) : options.inputs
  const files = await resolveInputs(inputPaths, normalizeExtensions(config), baseDir)
  if (!files.length) {
    if (options.changed) return 0
    throw new Error('No matching Markdown files found.')
  }
  let changed = 0
  for (const file of files) {
    if (excluded(file, baseDir, config.exclude)) continue
    const before = await readInputFile(file, options.staged)
    const after = formatMarkdownText(before, { preset: config.preset, rules: config.rules, units: config.units, languageId: extname(file).toLowerCase() === '.mdx' ? 'mdx' : 'markdown' })
    if (before === after) continue
    changed++
    if (options.check) {
      const rules = normalizeRules(config.rules, config.preset ?? 'default')
      const violations = getMarkdownSpaceViolations(before, rules, config.units, extname(file).toLowerCase() === '.mdx' ? 'mdx' : 'markdown')
      for (const violation of violations)
        process.stdout.write(`${relative(process.cwd(), file) || basename(file)}:${violation.lineIndex + 1}:${violation.start + 1}: ${violation.code} ${violation.message}\n`)
    }
    if (options.diff) process.stdout.write(unifiedDiff(relative(process.cwd(), file) || basename(file), before, after))
    if (options.write) await writeFile(file, after)
  }
  if (options.check && changed > 0) return 1
  return 0
}

if (typeof require !== 'undefined' && require.main === module)
  runCli().then((code) => { process.exitCode = code }).catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 2 })
