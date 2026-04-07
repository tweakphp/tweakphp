import * as monaco from 'monaco-editor'
import nordTheme from './assets/editor-themes/nord.json'
import drakulaTheme from './assets/editor-themes/dracula.json'
import monokaiTheme from './assets/editor-themes/monokai.json'
import githubLightTheme from './assets/editor-themes/github-light.json'
import catppuccinTheme from './assets/editor-themes/catppuccin.json'
import nightOwlTheme from './assets/editor-themes/night-owl.json'
import rosePineTheme from './assets/editor-themes/rose-pine.json'

const themes: Record<string, monaco.editor.IStandaloneThemeData> = {
  'nord': nordTheme as monaco.editor.IStandaloneThemeData,
  'dracula': drakulaTheme as monaco.editor.IStandaloneThemeData,
  'monokai': monokaiTheme as monaco.editor.IStandaloneThemeData,
  'github-light': githubLightTheme as monaco.editor.IStandaloneThemeData,
  'catppuccin': catppuccinTheme as monaco.editor.IStandaloneThemeData,
  'night-owl': nightOwlTheme as monaco.editor.IStandaloneThemeData,
  'rose-pine': rosePineTheme as monaco.editor.IStandaloneThemeData,
}

export const themeNames = Object.keys(themes)

export const themeColors: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(themes).map(([name, theme]) => [name, theme.colors as Record<string, string>])
)

export const installThemes = () => {
  for (const [name, theme] of Object.entries(themes)) {
    monaco.editor.defineTheme(name, theme)
  }
}
