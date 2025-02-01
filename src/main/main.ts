import { app, BrowserWindow } from 'electron'
import path, { join } from 'path'
import log from 'electron-log/main'

import * as dotenv from 'dotenv'
import * as source from './source'
import * as client from './client/index.ts'
import * as settings from './settings'
import * as lsp from './lsp/index'
import * as laravel from './laravel'
import * as updater from './system/updater.ts'
import * as link from './system/link.ts'
import * as tray from './system/tray.ts'

import url from 'url'

import { fixPath } from './utils/fix-path.ts'
import { isWindows } from './system/platform.ts'

fixPath()

Object.assign(console, log.functions)

dotenv.config()

export let window: BrowserWindow

const createMainWindow = async () => {
  window = new BrowserWindow({
    title: 'TweakPHP',
    minWidth: 1100,
    minHeight: 700,
    width: settings.getSettings().windowWidth,
    height: settings.getSettings().windowHeight,
    show: false,
    maximizable: true,
    minimizable: true,
    resizable: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      devTools: !app.isPackaged,
    },
    alwaysOnTop: false,
    center: true,
    icon: path.join(app.getAppPath(), 'build/icon.png'),
  })

  window.setMenuBarVisibility(false)

  window.webContents.on('did-finish-load', async () => {
    try {
      window.webContents.send('init.reply', {
        settings: settings.getSettings(),
      })

      window.show()

      window.once('show', async () => {
        setTimeout(async () => {
          await laravel.init(window)
          !isWindows() && (await lsp.init())
          await updater.checkForUpdates()
        }, 1500)
      })
    } catch (error) {
    } finally {
      window.setProgressBar(-1)
    }
  })

  window.on('close', (): void => {
    window.webContents.send('ssh.disconnect')
  })

  window.on('closed', (): void => {
    app.exit(0)
  })

  window.on('resize', (): void => {
    const [width, height] = window.getSize()
    settings.setSettings({
      ...settings.getSettings(),
      windowWidth: width,
      windowHeight: height,
    })
  })

  const isDev: boolean = process.env.NODE_ENV === 'development'

  const route = isDev
    ? `http://localhost:${process.env.VITE_SERVER_PORT || 4999}`
    : url.format({
        pathname: join(__dirname, 'app', 'index.html'),
        protocol: 'file:',
        slashes: true,
      })

  await window.loadURL(route)

  isDev && window.webContents.openDevTools()
}

const initializeModules = async () => {
  await Promise.all([settings.init(), tray.init(), updater.init(), link.init(), client.init(), source.init()])
}

app.whenReady().then(async () => {
  await createMainWindow()
  await initializeModules()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await lsp.shutdown()
})
