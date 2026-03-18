/**
 * 构建 Web 扩展入口（用于 vscode.dev / github.dev）
 * 输出单文件到 dist/web/extension.js，供 package.json 的 "browser" 使用
 */
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = `${__dirname}/../dist/web`
const production = process.argv.includes('--production')

if (!existsSync(outDir))
  mkdirSync(outDir, { recursive: true })

await esbuild.build({
  entryPoints: [`${__dirname}/../src/index.ts`],
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  platform: 'browser',
  outfile: `${outDir}/extension.js`,
  external: ['vscode'],
  define: {
    global: 'globalThis',
  },
  logLevel: 'info',
})
