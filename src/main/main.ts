import { app, BrowserWindow, dialog, ipcMain } from 'electron'
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
import * as mcp from './mcp/index.ts'

import { runMigrations } from './db/migration.ts'
import { initStorageIpc } from './ipc/storage-ipc.ts'

import url from 'url'

import { fixPath } from './utils/fix-path.ts'
import { AiCompletion } from './tools/ai-completion.ts'
import { Tab } from '../types/tab.type.ts'
import { initLogger } from './utils/logger.ts'

Object.assign(console, log.functions)

initLogger(log, settings.settingsDir, 7)

runMigrations()
initStorageIpc()

fixPath()

dotenv.config()

export let window: BrowserWindow

const RESIZE_SAVE_DEBOUNCE_MS = 300
let resizeSaveTimer: NodeJS.Timeout | null = null

const saveWindowSize = () => {
  if (!window || window.isDestroyed()) return
  const [width, height] = window.getSize()
  settings.setSettings({
    ...settings.getSettings(),
    windowWidth: width,
    windowHeight: height,
  })
}

const flushPendingWindowSizeSave = () => {
  if (resizeSaveTimer) {
    clearTimeout(resizeSaveTimer)
    resizeSaveTimer = null
    saveWindowSize()
  }
}

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
      window.once('show', async () => {
        setTimeout(async () => {
          await laravel.init(window)
          await lsp.init()
          await updater.checkForUpdates()
        }, 1500)
      })

      window.show()
    } catch (error) {
      console.error(error)
    } finally {
      window.setProgressBar(-1)
    }
  })

  window.on('close', (): void => {
    flushPendingWindowSizeSave()
    window.webContents.send('ssh.disconnect')
  })

  window.on('closed', (): void => {
    app.exit(0)
  })

  window.on('resize', (): void => {
    if (resizeSaveTimer) {
      clearTimeout(resizeSaveTimer)
    }
    resizeSaveTimer = setTimeout(() => {
      resizeSaveTimer = null
      saveWindowSize()
    }, RESIZE_SAVE_DEBOUNCE_MS)
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

ipcMain.on('init', event => {
  event.sender.send('init.reply', {
    settings: settings.getSettings(),
  })
})

const initializeModules = async () => {
  await Promise.all([
    settings.init(),
    tray.init(),
    updater.init(),
    link.init(),
    client.init(),
    source.init(),
    mcp.init(),
  ])
}

app.whenReady().then(async () => {
  try {
    await createMainWindow()
    await initializeModules()
  } catch (error) {
    console.error('Failed to start TweakPHP:', error)
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox('TweakPHP failed to start', message)
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await lsp.shutdown()
  const mcpServer = mcp.getMCPServer()
  if (mcpServer.isRunning()) {
    await mcpServer.stop()
  }
})

ipcMain.on('lsp.restart', async event => {
  console.log('Received request to restart LSP server.')

  try {
    await lsp.shutdown()
    console.log('Previous LSP server shut down. Restarting...')
    await lsp.init()
    console.log('LSP server restarted successfully.')
    event.sender.send('lsp.restart.success')
  } catch (error) {
    console.error('Failed to restart LSP server:', error)
    event.sender.send('lsp.restart.error', error)
  }
})

const aiService = new AiCompletion()

ipcMain.handle('ai:get-completion', async (_event, { context, tab }) => {
  try {
    return await aiService.getCompletions(context, tab as Tab)
  } catch (error: any) {
    return { completion: [], error: error.message }
  }
})
