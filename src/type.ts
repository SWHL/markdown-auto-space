/** 各条加空格规则的开关 */
export interface MarkdownSpaceRulesType {
  chineseAlnum: boolean
  chineseBacktick: boolean
  chineseLinkUrl: boolean
  dunhaoToComma: boolean
  slashSpace: boolean
}

export const DEFAULT_MARKDOWN_SPACE_RULES: MarkdownSpaceRulesType = {
  chineseAlnum: true,
  chineseBacktick: true,
  chineseLinkUrl: true,
  dunhaoToComma: true,
  slashSpace: true,
}

/** 扩展配置（从 VS Code 读取） */
export interface AutoSpaceConfigType {
  formatOnSave: boolean
  formatOnDocument: boolean
  spaceType: 'all' | 'comment'
  rules?: Partial<MarkdownSpaceRulesType>
}
