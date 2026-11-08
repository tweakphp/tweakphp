import { ipcMain } from 'electron'
import { ConnectionsRepository } from '../db/repositories/connections-repository'
import { ConnectionManager } from '../mcp/connection-manager'
import { broadcastAppChange } from './broadcast'

const connectionsRepo = new ConnectionsRepository()

let globalMcpConnectionManager: ConnectionManager | null = null

export function setMcpConnectionManager(manager: ConnectionManager): void {
  globalMcpConnectionManager = manager
  syncConnectionsToMcpManager(manager)
}

function syncConnectionsToMcpManager(manager: ConnectionManager): void {
  // Full resync (adds new rows, drops deleted ones — e.g. project cascade deletes)
  manager.reloadFromRepository()
}

export function syncConnectionsToMcpManagerIfActive(): void {
  if (globalMcpConnectionManager) {
    syncConnectionsToMcpManager(globalMcpConnectionManager)
  }
}

export function registerConnectionsIpc(): void {
  ipcMain.handle('storage:connections:list', async () => {
    return connectionsRepo.getAllConnections()
  })

  ipcMain.handle('storage:connections:save', async (_event, connection: any) => {
    const saved = connectionsRepo.saveConnection(connection)

    if (globalMcpConnectionManager) {
      globalMcpConnectionManager.addConnection(saved.id, saved as any)
    }

    // Push sync: re-align all renderer stores (unified + per-type) with the DB
    broadcastAppChange('app:connections:changed')

    return saved
  })

  ipcMain.handle('storage:connections:delete', async (_event, id: string) => {
    const success = connectionsRepo.deleteConnection(id)
    if (success) {
      if (globalMcpConnectionManager) {
        globalMcpConnectionManager.removeConnection(id)
      }
      broadcastAppChange('app:connections:changed')
    }
    return { success }
  })
}
