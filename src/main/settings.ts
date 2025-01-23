import path from 'path'
import * as fs from 'node:fs'
import * as lsp from './lsp/index'
import { app, ipcMain } from 'electron'
import { Settings } from '../types/settings.type'
import os from 'os'
import { isWindows } from './system/platform.ts'

const homeDir = os.homedir()

const laravelPath = app.isPackaged
  ? path.join(process.resourcesPath, 'public/laravel')
  : path.join(__dirname, 'laravel')

const settingsDir = path.join(homeDir, '.tweakphp')
if (app.isPackaged && !fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true })
}

const settingsPath = app.isPackaged ? path.join(settingsDir, 'settings.json') : path.join(__dirname, 'settings.json')

const defaultSettings: Settings = {
  version: app.getVersion(),
  laravelPath: laravelPath,
  php: '',
  theme: 'dracula',
  editorFontSize: 15,
  editorWordWrap: 'on',
  layout: 'vertical',
  vimMode: 'off',
}

export const init = async () => {
  ipcMain.on('settings.store', storeSettings)
}

export const storeSettings = async (_event: any, data: Settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(data))
  !isWindows() && (await lsp.init())
}

export const getSettings = () => {
  let settingsRaw: string = ''
  let settings: Settings

  if (fs.existsSync(settingsPath)) {
    settingsRaw = fs.readFileSync(settingsPath).toString()
  }

  if (settingsRaw) {
    let settingsJson = JSON.parse(settingsRaw)
    settings = {
      version: defaultSettings.version,
      laravelPath: settingsJson.laravelPath || defaultSettings.laravelPath,
      php: settingsJson.php || defaultSettings.php,
      theme: settingsJson.theme || defaultSettings.theme,
      editorFontSize: settingsJson.editorFontSize || defaultSettings.editorFontSize,
      editorWordWrap: settingsJson.editorWordWrap || defaultSettings.editorWordWrap,
      layout: settingsJson.layout || defaultSettings.layout,
      vimMode: settingsJson.vimMode || defaultSettings.vimMode,
    }
  } else {
    settings = defaultSettings
    storeSettings(null, settings)
  }

  // merge default settings with stored settings and take stored settings as priority
  return settings
}
