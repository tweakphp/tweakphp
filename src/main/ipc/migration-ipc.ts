import { ipcMain } from 'electron'
import { db } from '../db/db_manager'
import { ConnectionsRepository } from '../db/repositories/connections-repository'
import { TabsRepository } from '../db/repositories/tabs-repository'
import { LoadersRepository } from '../db/repositories/loaders-repository'
import { syncConnectionsToMcpManagerIfActive } from './connections-ipc'

const connectionsRepo = new ConnectionsRepository()
const tabsRepo = new TabsRepository()
const loadersRepo = new LoadersRepository()

export function registerMigrationIpc(): void {
  ipcMain.handle('storage:migration:check', async () => {
    const row = db.prepare(`SELECT value FROM settings_kv WHERE key = 'localstorage_migrated'`).get() as any
    return { migrated: Boolean(row && row.value === 'true') }
  })

  ipcMain.handle('storage:migration:import', async (_event, payload: any) => {
    const transaction = db.transaction(() => {
      if (payload.connections && Array.isArray(payload.connections)) {
        for (const conn of payload.connections) {
          if (!conn || !conn.type) continue
          try {
            connectionsRepo.saveConnection(conn)
          } catch (error) {
            console.warn(`Failed to import connection of type ${conn.type}:`, error)
          }
        }
      }

      if (payload.tabs && Array.isArray(payload.tabs)) {
        tabsRepo.saveAllTabs(payload.tabs)
      }

      if (payload.loaders && Array.isArray(payload.loaders)) {
        for (const loader of payload.loaders) {
          if (!loader || typeof loader.name !== 'string') continue
          loadersRepo.saveLoader(loader)
        }
      }

      db.prepare(
        `
        INSERT INTO settings_kv (key, value) VALUES ('localstorage_migrated', 'true')
        ON CONFLICT(key) DO UPDATE SET value = 'true'
      `
      ).run()
    })

    transaction()
    syncConnectionsToMcpManagerIfActive()

    return { success: true }
  })
}
