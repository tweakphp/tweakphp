/**
 * Project connection resolution for MCP tools
 * Resolves the active connection of a project (tab) exactly like the
 * frontend does: tab.connection_id first, then the implicit local connection.
 */

import { TabsRepository, TabRecord } from '../../db/repositories/tabs-repository'
import { ConnectionsRepository, StoredConnection } from '../../db/repositories/connections-repository'
import { broadcastAppChange } from '../../ipc/broadcast'
import { MCPErrorCode } from '../types'
import { getErrorHandler } from '../error-handler'
import { getSettings } from '../../settings'

export interface ProjectConnection {
  tab: TabRecord
  connection: Record<string, any>
}

export interface ProjectConnectionDeps {
  tabsRepo?: TabsRepository
  connectionsRepo?: ConnectionsRepository
}

export function getProjectTab(projectId: number, deps: ProjectConnectionDeps = {}): TabRecord {
  const tabsRepo = deps.tabsRepo ?? new TabsRepository()
  const tab = tabsRepo.getTab(projectId)
  if (!tab) {
    throw getErrorHandler().createError(MCPErrorCode.NOT_FOUND, `Project with ID ${projectId} not found`)
  }
  return tab
}

/**
 * Resolve the execution connection of a project. Returns null when the tab
 * has no usable connection configured (should not normally happen since
 * local is the implicit default).
 */
export function resolveProjectConnection(
  projectId: number,
  deps: ProjectConnectionDeps = {}
): ProjectConnection | null {
  const tabsRepo = deps.tabsRepo ?? new TabsRepository()
  const connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
  const tab = getProjectTab(projectId, { tabsRepo })

  // Preferred path: the tab's assigned active connection
  if (tab.connection_id) {
    const stored = connectionsRepo.getConnection(tab.connection_id)
    if (stored && stored.type === tab.execution) {
      return { tab, connection: decorate(stored, connectionsRepo) }
    }
  }

  if (tab.execution === 'vapor') {
    const vapor = connectionsRepo.getConnection(String(tab.id))
    if (vapor && vapor.type === 'vapor') {
      return { tab, connection: decorate(vapor, connectionsRepo) }
    }
    // vapor without discovered config still executes through the client
    return { tab, connection: { type: 'vapor', id: tab.id } }
  }

  // Implicit local connection (settings php + project path)
  const settings = getSettings()
  return {
    tab,
    connection: {
      type: 'local',
      path: tab.path ?? '',
      php: settings.php,
    },
  }
}

function decorate(connection: StoredConnection, connectionsRepo: ConnectionsRepository): Record<string, any> {
  const config: Record<string, any> = { ...connection }

  // Docker over SSH: attach the ssh credentials referenced by ssh_id
  if (config.type === 'docker' && config.ssh_id) {
    const ssh = connectionsRepo.getConnection(String(config.ssh_id))
    if (ssh) {
      config.ssh = ssh
    }
  }

  return config
}

/**
 * Persist the tab → connection assignment (the frontend does the same on connect).
 * Validates that the connection belongs to the project (atomic ownership).
 */
export function assignConnectionToProject(
  projectId: number,
  connectionId: string,
  deps: ProjectConnectionDeps = {}
): number {
  const tabsRepo = deps.tabsRepo ?? new TabsRepository()
  const connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
  const errorHandler = getErrorHandler()

  const tab = tabsRepo.getTab(projectId)
  if (!tab) {
    throw errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${projectId} not found`)
  }

  const connection = connectionsRepo.getConnection(connectionId)
  if (!connection) {
    throw errorHandler.createError(MCPErrorCode.NOT_FOUND, `Connection ${connectionId} not found`)
  }

  if (connection.tab_id !== null && connection.tab_id !== undefined && Number(connection.tab_id) !== projectId) {
    throw errorHandler.createError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Connection ${connectionId} belongs to another project (connections are atomic to a project)`
    )
  }

  tab.connection_id = connectionId
  tab.execution = connection.type

  if (connection.type === 'local') {
    tab.connection_id = null
  }

  tabsRepo.saveTab(tab)
  broadcastAppChange('app:tabs:changed')
  return projectId
}

/**
 * Reset a project back to the implicit local connection (frontend parity with
 * remoteRemoved / vaporRemoved).
 */
export function resetProjectToLocal(projectId: number, deps: ProjectConnectionDeps = {}): boolean {
  const tabsRepo = deps.tabsRepo ?? new TabsRepository()
  const errorHandler = getErrorHandler()

  const tab = tabsRepo.getTab(projectId)
  if (!tab) {
    throw errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${projectId} not found`)
  }

  tab.execution = 'local'
  tab.connection_id = null

  tabsRepo.saveTab(tab)
  broadcastAppChange('app:tabs:changed')
  return true
}
