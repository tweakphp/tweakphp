import { dialog, ipcMain, shell } from 'electron'
import { IpcMainEvent } from 'electron'

export const init = async () => {
  ipcMain.on('source.open', open)
  ipcMain.on('source.openPath', openPath)
}

export const open = async (event: IpcMainEvent) => {
  // Use shell.openPath to open the specified folder
  dialog.showOpenDialog({ properties: ['openDirectory'] }).then(result => {
    if (!result.canceled) {
      event.reply('source.open.reply', result.filePaths[0])
    }
  })
}

export const openPath = async (event: IpcMainEvent, path: string) => {
  if (path) {
    const errorMessage = await shell.openPath(path)
    if (errorMessage) {
      console.error(`Impossible to open the path ${path}: ${errorMessage}`)
    }
  } else {
    console.warn('Tentative to open an empty or invalid path')
  }
}
