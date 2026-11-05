import { ipcMain } from 'electron'
import { WorkspaceFoldersRepository } from '../db/repositories/workspace-folders-repository'
import { WorkspaceFolder } from '../../types/workspace-folder.type'

const foldersRepo = new WorkspaceFoldersRepository()

export function registerWorkspaceFoldersIpc(): void {
  ipcMain.handle('storage:folders:list', async () => {
    return foldersRepo.getAllFolders()
  })

  ipcMain.handle('storage:folders:create', async (_event, name: string) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed || trimmed.length > 100) {
      throw new Error('Folder name must be between 1 and 100 characters')
    }
    return foldersRepo.createFolder(trimmed)
  })

  ipcMain.handle('storage:folders:update', async (_event, folder: WorkspaceFolder) => {
    return { success: foldersRepo.updateFolder(folder) }
  })

  ipcMain.handle('storage:folders:delete', async (_event, id: number) => {
    return { success: foldersRepo.deleteFolder(id) }
  })

  ipcMain.handle('storage:folders:reorder', async (_event, ids: number[]) => {
    foldersRepo.reorderFolders(ids)
    return { success: true }
  })
}
