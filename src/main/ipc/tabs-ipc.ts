import { ipcMain } from 'electron'
import { TabsRepository, TabRecord } from '../db/repositories/tabs-repository'
import { broadcastAppChange } from './broadcast'
import { syncConnectionsToMcpManagerIfActive } from './connections-ipc'

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
    const success = tabsRepo.restoreTab(id)

    if (success) {
      broadcastAppChange('app:tabs:changed')
    }

    return { success }
  })

  ipcMain.handle('storage:tabs:force-delete', async (_event, id: string) => {
    const success = tabsRepo.deleteTab(id, true)

    if (success) {
      broadcastAppChange('app:tabs:changed')
      broadcastAppChange('app:connections:changed')
      syncConnectionsToMcpManagerIfActive()
    }

    return { success }
  })
}
