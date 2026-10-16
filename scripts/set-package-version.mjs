import { readFile, writeFile } from 'node:fs/promises'

const versionInput = process.argv.slice(2).find(argument => argument !== '--') ?? process.env.GITHUB_REF_NAME
const version = normalizeVersion(versionInput)
const packagePath = new URL('../package.json', import.meta.url)
const packageSource = await readFile(packagePath, 'utf8')
const packageJson = JSON.parse(packageSource)

if (packageJson.version !== version)
  await writeFile(packagePath, packageSource.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`))

function normalizeVersion(input) {
  const value = String(input ?? '').trim().replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value))
    throw new Error(`Expected a semantic version or v-prefixed tag, received: ${input ?? '(missing)'}`)
  return value
}
