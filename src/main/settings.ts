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
  output: 'code',
  vimMode: 'off',
  stackedDump: 'extended',
  windowWidth: 1100,
  windowHeight: 700,
  intelephenseLicenseKey: '' as any,
}

export const init = async () => {
  ipcMain.on('settings.store', async (_event: any, data: Settings) => {
    data.php = handlePhpExecutable(_event, data.php)
    setSettings(data)
    await lsp.init()
  })
}

const handlePhpExecutable = (_event: any, phpPath: string) => {
  try {
    if (fs.existsSync(phpPath) && fs.lstatSync(phpPath).isDirectory()) {
      const phpExecutable = isWindows() ? 'php.exe' : 'php'
      let potentialPath = path.join(phpPath, phpExecutable)

      if (fs.existsSync(potentialPath)) {
        phpPath = potentialPath
        _event.sender.send('settings.php-located', potentialPath)
      }
    }
  } catch (err) {
    // Ignore errors as path may no longer exist or has been changed etc..
  }
  return phpPath
}

export const setSettings = async (data: Settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(data))
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
      output: settingsJson.output || defaultSettings.output,
      vimMode: settingsJson.vimMode || defaultSettings.vimMode,
      stackedDump: settingsJson.stackedDump || defaultSettings.stackedDump,
      windowWidth: settingsJson.windowWidth || defaultSettings.windowWidth,
      windowHeight: settingsJson.windowHeight || defaultSettings.windowHeight,
      intelephenseLicenseKey: settingsJson.intelephenseLicenseKey || '',
    }
  } else {
    settings = defaultSettings
    setSettings(settings)
  }

  // merge default settings with stored settings and take stored settings as priority
  return settings
}
