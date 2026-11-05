import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Settings } from '../../types/settings.type.ts'
import { themeNames, themeColors } from '../themes'
import { applyPrimaryColors } from '../theme-primary-colors'

export const useSettingsStore = defineStore('settings', () => {
  const themes = ref(themeNames)

  let defaultSettings: Settings = {
    version: '',
    laravelPath: '',
    php: '',
    theme: 'dracula',
    editorFontSize: 15,
    editorWordWrap: 'on',
    layout: 'vertical',
    outputMode: 'output',
    vimMode: 'off',
    stackedDump: 'extended',
    windowWidth: 1100,
    windowHeight: 700,
    intelephenseLicenseKey: '',
    aiStatus: false,
    aiProvider: 'openrouter',
    aiModelId: '',
    aiApiKey: '',
    aiPromptTemplateGenerateCodeFromComment: '',
    aiPromptTemplateCompleteComment: '',
    aiPromptTemplateCompleteCode: '',
    mcpEnabled: false,
    mcpPort: 3000,
    streaming: true,
    queryLog: false,
    dockerKubectlExecutionTimeoutSeconds: 60,
  }

  const settings = ref<Settings>(defaultSettings)

  // Keep the app-wide `primary` color in sync with the selected editor theme.
  applyPrimaryColors(settings.value.theme)
  watch(
    () => settings.value.theme,
    theme => {
      applyPrimaryColors(theme)
    }
  )

  const colors = computed(() => {
    return themeColors[settings.value.theme as keyof typeof themeColors]
  })

  const setSettings = (s: any) => {
    settings.value = s
  }

  const update = () => {
    window.ipcRenderer.send('settings.store', {
      ...settings.value,
    })
  }

  return { settings, themes, setSettings, update, colors }
})
