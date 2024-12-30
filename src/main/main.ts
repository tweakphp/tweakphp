import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import log from 'electron-log/main'
import * as dotenv from 'dotenv'
import * as source from './source'
import * as client from './client'
import * as settings from './settings'
import * as lsp from './lsp/index'
import * as laravel from './laravel'
import * as updater from './updater'
import * as link from './link'
import * as tray from './tray'
import * as docker from './docker'

Object.assign(console, log.functions)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

export let window: BrowserWindow

app.whenReady().then(async () => {
  window = new BrowserWindow({
    title: 'TweakPHP',
    minWidth: 1100,
    minHeight: 700,
    width: 1100,
    height: 700,
    maximizable: true,
    minimizable: true,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: true,
      devTools: !app.isPackaged,
    },
    alwaysOnTop: false,
    center: true,
    icon: path.join(app.getAppPath(), 'build/icon.png'),
  })
  window.setMenuBarVisibility(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL)
    window.webContents.openDevTools()
  } else {
    await window.loadFile(path.join(__dirname, `./index.html`))
  }

  ipcMain.on('init', async event => {
    await laravel.init()
    await updater.checkForUpdates()
    event.reply('init.reply', {
      settings: settings.getSettings(),
    })
  })

  await docker.init()
  await tray.init()
  await lsp.init()
  await updater.init()
  await link.init()
  await settings.init()
  await client.init()
  await source.init()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await lsp.shutdown()
})
