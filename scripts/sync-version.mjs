import { readFile, writeFile } from 'node:fs/promises'

const versionInput = process.argv.slice(2).find(argument => argument !== '--') ?? process.env.GITHUB_REF_NAME
const version = normalizeVersion(versionInput)
const packagePath = new URL('../package.json', import.meta.url)
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const changed = packageJson.version !== version
const changelogPath = new URL('../CHANGELOG.md', import.meta.url)
const changelog = await readFile(changelogPath, 'utf8')
const releaseHeading = new RegExp(`^## \\[${escapeRegExp(version)}\\]`, 'm')
const changelogChanged = !releaseHeading.test(changelog)

if (changed)
  packageJson.version = version

if (changed)
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

if (changelogChanged) {
  if (!/^## \[未发布\]/m.test(changelog))
    throw new Error(`CHANGELOG.md has no [未发布] section to rename to ${version}`)

  const releaseDate = process.env.RELEASE_DATE ?? new Date().toISOString().slice(0, 10)
  const nextChangelog = changelog.replace(/^## \[未发布\].*$/m, `## [${version}] - ${releaseDate}`)
  await writeFile(changelogPath, nextChangelog)
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
