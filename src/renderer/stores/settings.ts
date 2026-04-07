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
    navigationDisplay: 'collapsed',
  }

  const settings = ref<Settings>(defaultSettings)

  const colors = computed(() => {
    return themeColors[settings.value.theme as keyof typeof themeColors]
  })

  const isNavigationExpanded = computed(() => settings.value.navigationDisplay === 'expanded')

  const setSettings = (s: any) => {
    settings.value = s
  }

  const update = () => {
    window.ipcRenderer.send('settings.store', {
      ...settings.value,
    })
  }

  return { settings, themes, setSettings, update, colors, isNavigationExpanded }
})
