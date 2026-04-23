/** 各条加空格规则的开关（内部使用规则键） */
export interface MarkdownSpaceRulesType {
  chineseAlnum: boolean
  chineseBacktick: boolean
  chineseLinkUrl: boolean
  chineseLinkText: boolean
  dunhaoToComma: boolean
  slashSpace: boolean
  /** MAS007 数字与单位之间加空格 */
  digitUnitSpace: boolean
  /** MAS008 度数、百分号与数字之间不空格 */
  tightDegreePercent: boolean
  /** MAS009 全形标点旁不留 ASCII 空格 */
  noSpaceAroundCjkPunct: boolean
}

export const DEFAULT_MARKDOWN_SPACE_RULES: MarkdownSpaceRulesType = {
  chineseAlnum: true,
  chineseBacktick: true,
  chineseLinkUrl: true,
  chineseLinkText: true,
  dunhaoToComma: true,
  slashSpace: true,
  digitUnitSpace: true,
  tightDegreePercent: true,
  noSpaceAroundCjkPunct: true,
}

/** 配置中的规则码（MAS001–MAS009）与内部规则键的映射 */
export const MAS_CODE_TO_RULE_KEY: Record<string, keyof MarkdownSpaceRulesType> = {
  MAS001: 'chineseAlnum',
  MAS002: 'chineseBacktick',
  MAS003: 'chineseLinkUrl',
  MAS004: 'dunhaoToComma',
  MAS005: 'slashSpace',
  MAS006: 'chineseLinkText',
  MAS007: 'digitUnitSpace',
  MAS008: 'tightDegreePercent',
  MAS009: 'noSpaceAroundCjkPunct',
}

/**
 * 将配置中的规则（MAS001–MAS009）转为内部 MarkdownSpaceRulesType（可用于测试或扩展内读取配置）
 * @param rulesRaw
 */
export function normalizeRules(rulesRaw: Record<string, boolean> | undefined): MarkdownSpaceRulesType {
  if (!rulesRaw)
    return DEFAULT_MARKDOWN_SPACE_RULES
  const rules: MarkdownSpaceRulesType = { ...DEFAULT_MARKDOWN_SPACE_RULES }
  for (const [key, value] of Object.entries(rulesRaw)) {
    const internalKey = MAS_CODE_TO_RULE_KEY[key]
    if (internalKey !== undefined)
      rules[internalKey] = value
  }
  return rules
}

/** 扩展配置（从 VS Code 读取）；rules 由 normalizeRules 填充为完整对象 */
export interface AutoSpaceConfigType {
  formatOnSave: boolean
  formatOnDocument: boolean
  rules: MarkdownSpaceRulesType
}

/**
 * TextDocumentSaveReason.Manual 的值（用户手动保存，如 Ctrl+S）。
 * 仅在此种保存时执行加空格修复，自动保存 / 失焦保存不修复。
 */
export const MANUAL_SAVE_REASON = 1

/**
 * 是否应在本次保存时执行加空格（仅手动保存时为 true，可单测）
 * @param reason
 */
export function shouldRunFormatOnSave(reason: number): boolean {
  return reason === MANUAL_SAVE_REASON
}

/** 规则说明文档 base URL（诊断中规则码点击链接），可单测 */
export const RULES_DOC_BASE_URL = 'https://github.com/SWHL/markdown-auto-space/blob/HEAD/docs/RULES.md'

/**
 * 返回某条规则在文档中的链接（带锚点），用于诊断 code.target，可单测
 * @param code
 */
export function getRuleDocUrl(code: string): string {
  return `${RULES_DOC_BASE_URL}#${code.toLowerCase()}`
}
