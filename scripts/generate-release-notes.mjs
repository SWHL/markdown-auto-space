import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const tag = process.argv.slice(2).find(argument => argument !== '--') ?? process.env.GITHUB_REF_NAME
const version = normalizeVersion(tag)
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const section = extractSection(changelog, new RegExp(`^## \\[${escapeRegExp(version)}\\](?:\\s|$)`, 'm'))

if (section)
  process.stdout.write(`${section}\n`)
else
  process.stdout.write(`${await generateCommitNotes()}\n`)

async function generateCommitNotes() {
  const runGit = promisify(execFile)
  let previousTag = ''

  try {
    ({ stdout: previousTag } = await runGit('git', ['describe', '--tags', '--abbrev=0', 'HEAD^']))
    previousTag = previousTag.trim()
  }
  catch {
    // Use the complete history when this is the first tagged release.
  }

  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD'
  const { stdout } = await runGit('git', ['log', '--no-merges', '--pretty=format:- %s', range])
  const commits = stdout.trim()
  return commits ? `### 变更\n\n${commits}` : '### 变更\n\n- 本次发布无可归类的提交。'
}

function extractSection(source, heading) {
  const match = heading.exec(source)
  if (!match)
    return ''

  const start = match.index + match[0].length
  const end = source.slice(start).search(/^##\s/m)
  return source.slice(start, end === -1 ? undefined : start + end).trim()
}

function normalizeVersion(input) {
  const value = String(input ?? '').trim().replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value))
    throw new Error(`Expected a semantic version or v-prefixed tag, received: ${input ?? '(missing)'}`)
  return value
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
