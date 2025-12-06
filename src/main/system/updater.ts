import { autoUpdater } from 'electron-updater'
import { UpdateInfo, CancellationToken } from 'builder-util-runtime'
import { ipcMain } from 'electron'
import { window } from '../main'

let update: UpdateInfo
let testProgressInterval: NodeJS.Timeout | null = null
let cancellationToken: CancellationToken | null = null

export const init = async () => {
  autoUpdater.autoDownload = false
  if (process.env.NODE_ENV === 'development') {
    autoUpdater.forceDevUpdateConfig = true
  }
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    update = info
    window.webContents.send('update.available', info)
  })
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    window.webContents.send('update.not-available', info)
  })
  autoUpdater.on('error', error => {
    console.error('Update error:', error)
    // In dev mode, send not-available to stop the checking state
    if (process.env.NODE_ENV === 'development') {
      window.webContents.send('update.not-available', {})
    }
  })
  autoUpdater.on('download-progress', progressInfo => {
    window.webContents.send('update.download-progress', {
      percent: progressInfo.percent,
      transferred: progressInfo.transferred,
      total: progressInfo.total,
      bytesPerSecond: progressInfo.bytesPerSecond,
    })
  })
  autoUpdater.on('update-downloaded', () => {
    window.webContents.send('update.downloaded')
    autoUpdater.quitAndInstall()
  })
  ipcMain.on('update.check', () => {
    checkForUpdates()
  })
  ipcMain.on('update.download', async (): Promise<void> => {
    window.webContents.send('update.available', update)
    // Create a new cancellation token for this download
    cancellationToken = new CancellationToken()
    await autoUpdater.downloadUpdate(cancellationToken)
  })

  ipcMain.on('update.test-progress', () => {
    // Clear any existing interval first
    if (testProgressInterval) {
      clearInterval(testProgressInterval)
      testProgressInterval = null
    }

    // Development mode: simulate download progress
    if (process.env.NODE_ENV === 'development') {
      let progress = 0
      testProgressInterval = setInterval(() => {
        progress += 10
        window.webContents.send('update.download-progress', {
          percent: progress,
          transferred: progress * 1024 * 1024,
          total: 100 * 1024 * 1024,
          bytesPerSecond: 2 * 1024 * 1024,
        })
        if (progress >= 100) {
          if (testProgressInterval) clearInterval(testProgressInterval)
          testProgressInterval = null
          window.webContents.send('update.downloaded')
        }
      }, 500)
    }
  })

  ipcMain.on('update.cancel', () => {
    // Cancel test progress in dev mode
    if (testProgressInterval) {
      clearInterval(testProgressInterval)
      testProgressInterval = null
    }

    // Cancel download in production using cancellation token
    if (cancellationToken) {
      try {
        cancellationToken.cancel()
        cancellationToken = null
        window.webContents.send('update.cancelled')
      } catch (error) {
        console.error('Failed to cancel update:', error)
      }
    }
  })
}

export const checkForUpdates = async () => {
  window.webContents.send('update.checking')

  // In development mode, just simulate no update available
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      window.webContents.send('update.not-available', {})
    }, 1000)
    return
  }

  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    console.error('Failed to check for updates:', error)
  }
}
