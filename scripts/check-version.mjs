import { readFile } from 'node:fs/promises'

const versionInput = process.argv.slice(2).find(argument => argument !== '--') ?? process.env.GITHUB_REF_NAME
const expectedVersion = normalizeVersion(versionInput)
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')

if (packageJson.version !== expectedVersion)
  throw new Error(`package.json version ${packageJson.version} does not match ${expectedVersion}`)

const heading = new RegExp(`^## \\[${escapeRegExp(expectedVersion)}\\](?: \\| -| -)`, 'm')
if (!heading.test(changelog))
  throw new Error(`CHANGELOG.md has no release heading for ${expectedVersion}`)

function normalizeVersion(input) {
  const value = String(input ?? '').trim().replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value))
    throw new Error(`Expected a semantic version or v-prefixed tag, received: ${input ?? '(missing)'}`)
  return value
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
