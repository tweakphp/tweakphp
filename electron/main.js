import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'
import * as source from './source.js'
import * as client from './client.js'
import { init as initLSP } from './lsp/index.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.whenReady().then(async () => {
    await initLSP()

    const window = new BrowserWindow({
        minWidth: 1000,
        minHeight: 600,
        width: 1000,
        height: 600,
        maximizable: false,
        minimizable: false,
        resizable: true,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // webSecurity: false,
        },
        alwaysOnTop: false,
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        await window.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        await window.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    window.webContents.openDevTools()

    ipcMain.on('client.execute', client.execute)
    ipcMain.on('client.info', client.info)
    ipcMain.on('source.open', source.open)
    // ipcMain.on('ssh.connect', ssh.connect)
})

app.on('window-all-closed', () => {
    app.quit()
})
