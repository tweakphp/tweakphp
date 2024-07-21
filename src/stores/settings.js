import { defineStore } from 'pinia'
import * as monaco from 'monaco-editor'
import nordTheme from '../assets/editor-themes/nord.json'
import drakulaTheme from '../assets/editor-themes/dracula.json'
import monokaiTheme from '../assets/editor-themes/monokai.json'
import githubLightTheme from '../assets/editor-themes/github-light.json'
import catppuccinTheme from '../assets/editor-themes/catppuccin.json'
import { computed, ref } from 'vue'

const themeColors = {
    'nord': nordTheme.colors,
    'dracula': drakulaTheme.colors,
    'monokai': monokaiTheme.colors,
    'github-light': githubLightTheme.colors,
    'catppuccin': catppuccinTheme.colors,
}

export const useSettingsStore = defineStore('settings', () => {
    // get keys of themeColors object
    const themes = ref(Object.keys(themeColors))

    let defaultSettings = {
        theme: 'dracula',
        editor: {
            fontSize: 18,
            wordWrap: 'on',
        },
        layout: 'vertical',
        php: '/opt/homebrew/bin/php',
    }

    let storedSettings = localStorage.getItem('settings')
    if (storedSettings) {
        storedSettings = JSON.parse(storedSettings)

        defaultSettings = {
            theme: storedSettings?.theme ?? defaultSettings.theme,
            editor: {
                fontSize: storedSettings?.editor?.fontSize ?? defaultSettings.editor.fontSize,
                wordWrap: storedSettings?.editor?.wordWrap ?? defaultSettings.editor.wordWrap,
            },
            layout: storedSettings?.layout ?? defaultSettings.layout,
            php: storedSettings?.php ?? defaultSettings.php,
        }
    }

    localStorage.setItem('settings', JSON.stringify(defaultSettings))

    const settings = ref(defaultSettings)

    const colors = computed(() => {
        return themeColors[settings.value.theme]
    })

    const update = () => {
        localStorage.setItem('settings', JSON.stringify(settings.value))
    }

    const defineEditorThemes = () => {
        monaco.editor.defineTheme('nord', nordTheme)
        monaco.editor.defineTheme('dracula', drakulaTheme)
        monaco.editor.defineTheme('monokai', monokaiTheme)
        monaco.editor.defineTheme('github-light', githubLightTheme)
        monaco.editor.defineTheme('catppuccin', catppuccinTheme)
    }

    return { settings, themes, update, colors, defineEditorThemes }
})
