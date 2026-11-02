export type OutputMode = 'output' | 'stacked' | 'full'

export interface Settings {
  version: string
  laravelPath: string
  php: string | ''
  theme: string
  editorFontSize: number
  editorWordWrap: string
  layout: string
  outputMode: OutputMode
  vimMode: string
  stackedDump: string
  windowWidth: number
  windowHeight: number
  intelephenseLicenseKey?: string
  aiStatus: boolean
  aiProvider?: string | null
  aiModelId?: string | null
  aiApiKey?: string | null
  aiPromptTemplateGenerateCodeFromComment: string
  aiPromptTemplateCompleteComment: string
  aiPromptTemplateCompleteCode: string
  mcpEnabled?: boolean
  mcpPort?: number
  streaming: boolean
  queryLog: boolean
  dockerKubectlExecutionTimeoutSeconds: number
}
