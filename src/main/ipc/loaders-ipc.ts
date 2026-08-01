import { ipcMain } from 'electron'
import { LoadersRepository, LoaderRecord } from '../db/repositories/loaders-repository'

const loadersRepo = new LoadersRepository()

export function registerLoadersIpc(): void {
  ipcMain.handle('storage:loaders:list', async () => {
    return loadersRepo.getAllLoaders()
  })

  ipcMain.handle('storage:loaders:save', async (_event, loader: LoaderRecord) => {
    loadersRepo.saveLoader(loader)
    return { success: true }
  })

  ipcMain.handle('storage:loaders:delete', async (_event, id: string) => {
    return { success: loadersRepo.deleteLoader(id) }
  })
}
