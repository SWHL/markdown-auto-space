import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
describe('extension build smoke tests', () => {
  it('produces a non-empty Desktop entrypoint', () => {
    const desktopEntry = resolve(root, 'dist/index.js')
    expect(existsSync(desktopEntry)).toBe(true)
    expect(statSync(desktopEntry).size).toBeGreaterThan(0)
  })

  it('produces a non-empty Web entrypoint', () => {
    const webEntry = resolve(root, 'dist/web/extension.js')
    expect(existsSync(webEntry)).toBe(true)
    expect(statSync(webEntry).size).toBeGreaterThan(0)
  })
})
