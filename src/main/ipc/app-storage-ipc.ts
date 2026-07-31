import { ipcMain } from 'electron'
import { AppStorageRepository } from '../db/repositories/app-storage-repository'

const appStorageRepo = new AppStorageRepository()

export function registerAppStorageIpc(): void {
  ipcMain.handle('storage:app:get', async (_event, key: string) => appStorageRepo.get(key))

  ipcMain.handle('storage:app:set', async (_event, key: string, value: unknown) => {
    appStorageRepo.set(key, value)
    return { success: true }
  })

  ipcMain.handle('storage:app:remove', async (_event, key: string) => ({
    success: appStorageRepo.remove(key),
  }))
}
