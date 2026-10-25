/**
 * Project connection resolution for MCP tools
 * Resolves the active connection of a project (tab) exactly like the
 * frontend does: tab.connection_id first, then the legacy inline refs
 * (tab.docker / tab.ssh / tab.kubectl), then the implicit local connection.
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
export function resolveProjectConnection(projectId: number, deps: ProjectConnectionDeps = {}): ProjectConnection | null {
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

  // Legacy fallbacks (tabs created before the connection_id refactor)
  if (tab.execution === 'docker' && tab.docker) {
    const docker: Record<string, any> = { ...tab.docker, type: 'docker' }
    if (docker.ssh_id) {
      const ssh = connectionsRepo.getConnection(String(docker.ssh_id))
      if (ssh) {
        docker.ssh = ssh
      }
    }
    return { tab, connection: docker }
  }

  if (tab.execution === 'ssh' && tab.ssh) {
    const ssh = connectionsRepo.getConnection(String(tab.ssh.id))
    if (ssh) {
      return { tab, connection: decorate(ssh, connectionsRepo) }
    }
  }

  if (tab.execution === 'kubectl' && tab.kubectl) {
    const kubectl = connectionsRepo.getConnection(String(tab.kubectl.id))
    if (kubectl) {
      return { tab, connection: decorate(kubectl, connectionsRepo) }
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

  // keep the legacy inline refs in sync so older UI paths keep working
  // (only meaningful for numeric ids, which is what the legacy refs store)
  const numericId = Number(connectionId)
  if (Number.isFinite(numericId)) {
    if (connection.type === 'ssh') {
      tab.ssh = { id: numericId }
    }
    if (connection.type === 'kubectl') {
      tab.kubectl = { id: numericId }
    }
  }
  if (connection.type === 'docker') {
    const { id, type, name, ssh, tab_id, ...config } = connection as any
    tab.docker = { ...config, id: Number(id) || 0, type: 'docker' }
  }
  if (connection.type === 'local') {
    tab.connection_id = null
    tab.docker = undefined
    tab.ssh = undefined
    tab.kubectl = undefined
  }

  tabsRepo.saveTab(tab)
  broadcastAppChange('app:tabs:changed')
  return projectId
}

/**
 * Reset a project back to the implicit local connection (frontend parity with
 * remoteRemoved / vaporRemoved). Accepts the connectionId that was removed so
 * stale legacy refs pointing at it are cleared too.
 */
export function resetProjectToLocal(projectId: number, removedConnectionId?: string, deps: ProjectConnectionDeps = {}): boolean {
  const tabsRepo = deps.tabsRepo ?? new TabsRepository()
  const errorHandler = getErrorHandler()

  const tab = tabsRepo.getTab(projectId)
  if (!tab) {
    throw errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${projectId} not found`)
  }

  tab.execution = 'local'
  tab.connection_id = null
  if (removedConnectionId !== undefined) {
    const numericId = Number(removedConnectionId)
    if (tab.ssh && Number.isFinite(numericId) && String(tab.ssh.id) === removedConnectionId) {
      tab.ssh = undefined
    }
    if (tab.kubectl && Number.isFinite(numericId) && String(tab.kubectl.id) === removedConnectionId) {
      tab.kubectl = undefined
    }
    if (tab.docker && String((tab.docker as any).id) === removedConnectionId) {
      tab.docker = undefined
    }
  } else {
    tab.ssh = undefined
    tab.kubectl = undefined
    tab.docker = undefined
  }

  tabsRepo.saveTab(tab)
  broadcastAppChange('app:tabs:changed')
  return true
}
