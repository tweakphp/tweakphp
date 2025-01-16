import { app, BrowserWindow } from 'electron'
import path, { join } from 'path'
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
import * as ssh from './ssh'
import * as dialog from './dialog'
import * as notification from './notification'
import * as kubectl from './kubectl'

import url from 'url'

import { fixPath } from './fix-path.ts'
import { isWindows } from './platform.ts'

fixPath()

Object.assign(console, log.functions)

dotenv.config()

export let window: BrowserWindow

const createMainWindow = async () => {
  window = new BrowserWindow({
    title: 'TweakPHP',
    minWidth: 1100,
    minHeight: 700,
    width: 1100,
    height: 700,
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
  await Promise.all([
    settings.init(),
    docker.init(),
    tray.init(),
    updater.init(),
    link.init(),
    client.init(),
    source.init(),
    ssh.init(),
    dialog.init(window),
    notification.init(),
    kubectl.init(),
  ])
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
