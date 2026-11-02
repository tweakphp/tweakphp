import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Settings } from '../../types/settings.type.ts'
import { themeNames, themeColors } from '../themes'

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
    output: 'code',
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

  const colors = computed(() => {
    return themeColors[settings.value.theme as keyof typeof themeColors] ?? themeColors[defaultSettings.theme]
  })

  const setSettings = (s: any) => {
    const merged: Settings = { ...defaultSettings, ...s }
    // A persisted theme may no longer exist in this build (removed or renamed
    // themes): fall back to the default instead of leaving `colors` undefined.
    if (!themes.value.includes(merged.theme)) {
      merged.theme = defaultSettings.theme
    }
    settings.value = merged
  }

  const update = () => {
    window.ipcRenderer.send('settings.store', {
      ...settings.value,
    })
  }

  return { settings, themes, setSettings, update, colors }
})
