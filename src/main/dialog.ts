import { BrowserWindow, dialog, ipcMain } from 'electron'

export const init = async (window: BrowserWindow) => {
  ipcMain.on('dialog', async (event, arg): Promise<void> => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: arg.buttons,
      title: arg.title,
      message: arg.message,
    })

    event.reply(arg.listener, {
      params: arg.params,
      result: choice,
    })
  })
}
