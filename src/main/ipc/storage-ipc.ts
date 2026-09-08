import { registerConnectionsIpc, setMcpConnectionManager } from './connections-ipc'
import { registerLoadersIpc } from './loaders-ipc'
import { registerMigrationIpc } from './migration-ipc'
import { registerTabsIpc } from './tabs-ipc'
import { registerCodeHistoryIpc } from './code-history-ipc'
import { registerAppStorageIpc } from './app-storage-ipc'
import { registerAppIpc } from './app-ipc'
import { registerSettingsIpc } from './settings-ipc'
import { registerLspIpc } from './lsp-ipc'
import { registerAiIpc } from './ai-ipc'
import { registerMcpIpc } from './mcp-ipc'

export { setMcpConnectionManager }

export function initIpc(): void {
  registerAppIpc()
  registerSettingsIpc()
  registerLspIpc()
  registerAiIpc()
  registerMcpIpc()
  registerMigrationIpc()
  registerConnectionsIpc()
  registerTabsIpc()
  registerLoadersIpc()
  registerCodeHistoryIpc()
  registerAppStorageIpc()
}
