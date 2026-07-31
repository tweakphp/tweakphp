import { registerConnectionsIpc, setMcpConnectionManager } from './connections-ipc'
import { registerLoadersIpc } from './loaders-ipc'
import { registerMigrationIpc } from './migration-ipc'
import { registerTabsIpc } from './tabs-ipc'
import { registerCodeHistoryIpc } from './code-history-ipc'

export { setMcpConnectionManager }

export function initStorageIpc(): void {
  registerMigrationIpc()
  registerConnectionsIpc()
  registerTabsIpc()
  registerLoadersIpc()
  registerCodeHistoryIpc()
}
