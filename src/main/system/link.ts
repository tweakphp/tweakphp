import { ipcMain, shell } from 'electron'

export const init = async () => {
  ipcMain.on('link.open', (_event: any, url: string) => {
    shell.openExternal(url)
  })
}
