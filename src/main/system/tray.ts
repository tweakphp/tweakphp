import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import * as updater from './updater'

export const init = async () => {
  const trayIconPath: string = path.join(app.getAppPath(), 'src/main/system/tray/IconTemplate.png')
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
