import { ipcMain } from 'electron'
import { ConnectionsRepository } from '../db/repositories/connections-repository'
import { ConnectionManager } from '../mcp/connection-manager'

const connectionsRepo = new ConnectionsRepository()

let globalMcpConnectionManager: ConnectionManager | null = null

export function setMcpConnectionManager(manager: ConnectionManager): void {
  globalMcpConnectionManager = manager
  syncConnectionsToMcpManager(manager)
}

function syncConnectionsToMcpManager(manager: ConnectionManager): void {
  const connections = connectionsRepo.getAllConnections()
  for (const conn of connections) {
    manager.addConnection(conn.id, conn as any)
  }
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

    return saved
  })

  ipcMain.handle('storage:connections:delete', async (_event, id: string) => {
    const success = connectionsRepo.deleteConnection(id)
    if (success && globalMcpConnectionManager) {
      globalMcpConnectionManager.removeConnection(id)
    }
    return { success }
  })

  ipcMain.handle('storage:connections:set-active', async (_event, id: string) => {
    connectionsRepo.setActiveConnection(id)
    const active = connectionsRepo.getActiveConnection()
    if (active && globalMcpConnectionManager) {
      globalMcpConnectionManager.setActiveConnection(active as any)
    }
    return { success: true, active }
  })
}
