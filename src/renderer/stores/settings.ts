import { defineStore } from 'pinia'
import * as monaco from 'monaco-editor'
import nordTheme from '../assets/editor-themes/nord.json'
import drakulaTheme from '../assets/editor-themes/dracula.json'
import monokaiTheme from '../assets/editor-themes/monokai.json'
import githubLightTheme from '../assets/editor-themes/github-light.json'
import catppuccinTheme from '../assets/editor-themes/catppuccin.json'
import { computed, ref } from 'vue'
import { Settings } from '../../types/settings.type.ts'

// Explicitly type the themes
const typedNordTheme = nordTheme as monaco.editor.IStandaloneThemeData
const typedDrakulaTheme = drakulaTheme as monaco.editor.IStandaloneThemeData
const typedMonokaiTheme = monokaiTheme as monaco.editor.IStandaloneThemeData
const typedGithubLightTheme = githubLightTheme as monaco.editor.IStandaloneThemeData
const typedCatppuccinTheme = catppuccinTheme as monaco.editor.IStandaloneThemeData

const themeColors: { [key: string]: { [key: string]: string } } = {
  'nord': nordTheme.colors,
  'dracula': drakulaTheme.colors,
  'monokai': monokaiTheme.colors,
  'github-light': githubLightTheme.colors,
  'catppuccin': catppuccinTheme.colors,
}

export const useSettingsStore = defineStore('settings', () => {
  // get keys of themeColors object
  const themes = ref(Object.keys(themeColors))

  let defaultSettings: Settings = {
    version: '',
    laravelPath: '',
    php: '',
    theme: 'dracula',
    editorFontSize: 15,
    editorWordWrap: 'on',
    layout: 'vertical',
    vimMode: 'off',
  }

  const settings = ref<Settings>(defaultSettings)

  const colors = computed(() => {
    return themeColors[settings.value.theme as keyof typeof themeColors]
  })

  const update = () => {
    // clone settings json
    window.ipcRenderer.send('settings.store', {
      ...settings.value,
    })
  }

  const defineEditorThemes = () => {
    monaco.editor.defineTheme('nord', typedNordTheme)
    monaco.editor.defineTheme('dracula', typedDrakulaTheme)
    monaco.editor.defineTheme('monokai', typedMonokaiTheme)
    monaco.editor.defineTheme('github-light', typedGithubLightTheme)
    monaco.editor.defineTheme('catppuccin', typedCatppuccinTheme)
  }

  return { settings, themes, update, colors, defineEditorThemes }
})
