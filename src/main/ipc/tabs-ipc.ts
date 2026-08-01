import { ipcMain } from 'electron'
import { TabsRepository, TabRecord } from '../db/repositories/tabs-repository'

const tabsRepo = new TabsRepository()

export function registerTabsIpc(): void {
  ipcMain.handle('storage:tabs:list', async () => {
    return tabsRepo.getAllTabs()
  })

  ipcMain.handle('storage:tabs:list-trashed', async () => {
    return tabsRepo.getTrashedTabs()
  })

  ipcMain.handle('storage:tabs:save-all', async (_event, tabs: TabRecord[]) => {
    tabsRepo.saveAllTabs(tabs)
    return { success: true }
  })

  ipcMain.handle('storage:tabs:delete', async (_event, id: string) => {
    return { success: tabsRepo.deleteTab(id, false) }
  })

  ipcMain.handle('storage:tabs:restore', async (_event, id: string) => {
    return { success: tabsRepo.restoreTab(id) }
  })

  ipcMain.handle('storage:tabs:force-delete', async (_event, id: string) => {
    return { success: tabsRepo.deleteTab(id, true) }
  })
}
