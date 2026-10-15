import { processMarkdownContent } from './markdownSpace'
import type { DigitUnitOptions } from './markdownSpace'
import type { MarkdownAutoSpacePreset, MarkdownSpaceRulesType } from './type'
import { normalizeRules } from './type'

/** Options shared by the VS Code extension and the standalone CLI. */
export interface MarkdownFormatOptions {
  /** Rule codes (MAS001-MAS009) as used by VS Code configuration. */
  rules?: Record<string, boolean>
  preset?: MarkdownAutoSpacePreset
  units?: DigitUnitOptions
  languageId?: string
}

/** Format Markdown text without any filesystem or editor dependency. */
export function formatMarkdownText(text: string, options: MarkdownFormatOptions = {}): string {
  const rawRules = options.rules ?? {}
  const usesInternalKeys = Object.keys(rawRules).some(key => key === 'chineseAlnum' || key === 'digitUnitSpace')
  const rules: MarkdownSpaceRulesType = usesInternalKeys
    ? { ...normalizeRules(undefined, options.preset ?? 'default'), ...(rawRules as Partial<MarkdownSpaceRulesType>) }
    : normalizeRules(rawRules, options.preset ?? 'default')
  return processMarkdownContent(text, rules, options.units ?? {}, options.languageId ?? 'markdown')
}
