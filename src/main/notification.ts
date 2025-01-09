import { ipcMain, Notification } from 'electron'

export const init = async () => {
  ipcMain.on('notification', (event, args) => {
    new Notification({
      title: args.title,
      body: args.message,
    }).show()
  })
}
