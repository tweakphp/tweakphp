import type { IpcMainInvokeEvent } from 'electron'
import path from 'path'
import * as fs from 'node:fs'
import { z } from 'zod'
import { detectPhpPaths, getSettings, setSettings } from '../settings'
import { Settings } from '../../types/settings.type'
import { isWindows } from '../system/platform'
import { initLsp } from '../lsp/coordinator'
import { registerIpcHandler } from './ipc-utils'

const settingsSchema = z.object({
  version: z.string(),
  laravelPath: z.string(),
  php: z.string(),
  theme: z.string(),
  editorFontSize: z.coerce.number(),
  editorWordWrap: z.string(),
  layout: z.string(),
  output: z.string(),
  vimMode: z.string(),
  stackedDump: z.string(),
  windowWidth: z.coerce.number(),
  windowHeight: z.coerce.number(),
  intelephenseLicenseKey: z.string().optional(),
  aiStatus: z.boolean(),
  aiProvider: z.string().optional(),
  aiModelId: z.string().optional(),
  aiApiKey: z.string().optional(),
  aiPromptTemplateGenerateCodeFromComment: z.string(),
  aiPromptTemplateCompleteComment: z.string(),
  aiPromptTemplateCompleteCode: z.string(),
  navigationDisplay: z.string(),
  mcpEnabled: z.boolean(),
  mcpPort: z.coerce.number(),
  streaming: z.boolean(),
  dockerKubectlExecutionTimeoutSeconds: z.coerce.number(),
})

const handlePhpExecutable = (event: IpcMainInvokeEvent, phpPath: string) => {
  try {
    if (fs.existsSync(phpPath) && fs.lstatSync(phpPath).isDirectory()) {
      const phpExecutable = isWindows() ? 'php.exe' : 'php'
      const potentialPath = path.join(phpPath, phpExecutable)

      if (fs.existsSync(potentialPath)) {
        phpPath = potentialPath
        event.sender.send('settings:php-located', potentialPath)
      }
    }
  } catch {
    // Ignore errors as path may no longer exist or has been changed etc..
  }
  return phpPath
}

const persistSettings = (event: IpcMainInvokeEvent, data: Settings) => {
  const saved = {
    ...data,
    php: handlePhpExecutable(event, data.php),
    // normalize the optional AI fields to the '' = unset convention
    aiProvider: data.aiProvider ?? '',
    aiModelId: data.aiModelId ?? '',
    aiApiKey: data.aiApiKey ?? '',
  }
  setSettings(saved)
  return saved
}

/**
 * Only LSP-relevant settings (php binary, intelephense license) require a
 * language server restart — cosmetic toggles (streaming, theme, layout, ...)
 * must not bounce the websocket server (it caused EADDRINUSE on restarts)
 */
const lspRelevantSettingsChanged = (previous: Settings, next: Settings): boolean => {
  return previous.php !== next.php || (previous.intelephenseLicenseKey ?? '') !== (next.intelephenseLicenseKey ?? '')
}

export function registerSettingsIpc(): void {
  registerIpcHandler(
    'settings:store',
    async (data, event) => {
      const previous = getSettings()
      const saved = persistSettings(event, data)
      if (!isWindows() && lspRelevantSettingsChanged(previous, saved)) {
        await initLsp()
      }
      return { success: true }
    },
    settingsSchema
  )

  registerIpcHandler(
    'settings:save',
    async (data, event) => {
      persistSettings(event, data)
      await initLsp()
      return { success: true }
    },
    settingsSchema
  )

  registerIpcHandler('settings:detect-php', async () => detectPhpPaths())
}
