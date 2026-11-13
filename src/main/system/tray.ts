import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import * as updater from './updater'

export const init = async () => {
  const trayIconPath: string = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'IconTemplate.png')
    : path.join(__dirname, '../build', 'IconTemplate.png')
  const tray = new Tray(nativeImage.createFromPath(trayIconPath))
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Check for updates',
      click: async () => {
        await updater.checkForUpdates()
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
}
