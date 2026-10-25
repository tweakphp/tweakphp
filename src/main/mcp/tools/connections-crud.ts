/**
 * Connection CRUD tools for MCP
 * Connections are atomic to a project: every connection is owned by exactly
 * one project (tab) and cannot be shared. Local execution stays implicit.
 * Secrets are never included in tool responses.
 */

import { CreateConnectionParams, UpdateConnectionParams, DeleteConnectionParams } from './schemas'
import { ConnectionsRepository, StoredConnection } from '../../db/repositories/connections-repository'
import { TabsRepository } from '../../db/repositories/tabs-repository'
import { broadcastAppChange } from '../../ipc/broadcast'
import { ConnectionManager } from '../connection-manager'
import { ConnectionSchema } from '../../../types/connection.type'
import { MCPErrorCode } from '../types'
import { getErrorHandler } from '../error-handler'
import { assignConnectionToProject, resetProjectToLocal } from './project-connection'
import { getSettings } from '../../settings'
import { randomUUID } from 'crypto'

const SECRET_KEYS = ['password', 'privateKey', 'passphrase', 'auth_token', 'ssh'] as const

export function sanitizeConnection(connection: Record<string, any>): Record<string, any> {
  const sanitized = { ...connection }
  for (const key of SECRET_KEYS) {
    if (key in sanitized) {
      delete sanitized[key]
    }
  }
  return sanitized
}

export interface ConnectionCrudDeps {
  connectionsRepo?: ConnectionsRepository
  tabsRepo?: TabsRepository
}

export class CreateConnectionHandler {
  private connectionsRepo: ConnectionsRepository
  private tabsRepo: TabsRepository
  private connectionManager: ConnectionManager
  private errorHandler = getErrorHandler()

  constructor(connectionManager: ConnectionManager, deps: ConnectionCrudDeps = {}) {
    this.connectionManager = connectionManager
    this.connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
  }

  async handle(
    params: CreateConnectionParams
  ): Promise<{ connection: Record<string, any>; assignedToProject?: number }> {
    if (params.projectId === undefined || params.projectId === null) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "projectId" is required: connections are atomic to a project'
      )
    }

    const tab = this.tabsRepo.getTab(params.projectId)
    if (!tab) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${params.projectId} not found`)
    }

    // Local execution is implicit (settings php + project path): no row is
    // persisted, the project is simply reset to the implicit local connection
    if (params.type === 'local') {
      resetProjectToLocal(params.projectId, {
        tabsRepo: this.tabsRepo,
        connectionsRepo: this.connectionsRepo,
      })
      const settings = getSettings()
      return {
        connection: {
          type: 'local',
          name: 'Local',
          path: params.config?.path ?? tab.path ?? settings.laravelPath,
          php: params.config?.php ?? settings.php,
        },
        assignedToProject: params.projectId,
      }
    }

    const candidate = {
      ...params.config,
      id: (params.config as Record<string, any>).id ?? randomUUID(),
      type: params.type,
      tab_id: params.projectId,
    }

    const parsed = ConnectionSchema.safeParse(candidate)
    if (!parsed.success) {
      throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Invalid connection config', {
        issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const saved = this.connectionsRepo.saveConnection(parsed.data as any)
    this.connectionManager.addConnection(saved.id, saved as any)

    // Assign as the project's active connection (frontend connect flow parity)
    assignConnectionToProject(params.projectId, saved.id, {
      tabsRepo: this.tabsRepo,
      connectionsRepo: this.connectionsRepo,
    })

    broadcastAppChange('app:connections:changed')
    return { connection: sanitizeConnection(saved as any), assignedToProject: params.projectId }
  }
}

export class UpdateConnectionHandler {
  private connectionsRepo: ConnectionsRepository
  private connectionManager: ConnectionManager
  private errorHandler = getErrorHandler()

  constructor(connectionManager: ConnectionManager, deps: ConnectionCrudDeps = {}) {
    this.connectionManager = connectionManager
    this.connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
  }

  async handle(params: UpdateConnectionParams): Promise<{ connection: Record<string, any> }> {
    const existing = this.connectionsRepo.getConnection(params.connectionId)
    if (!existing) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Connection ${params.connectionId} not found`)
    }

    if ('type' in params.changes && params.changes.type !== existing.type) {
      throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Connection type cannot be changed')
    }

    if ('tab_id' in params.changes && params.changes.tab_id !== existing.tab_id) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Connection ownership cannot be changed: connections are atomic to a project'
      )
    }

    // Ownership and id/type are immutable: never merge them from changes
    const { id, type, tab_id, ...configChanges } = params.changes as Record<string, any>
    const merged = { ...existing, ...configChanges }

    const parsed = ConnectionSchema.safeParse(merged)
    if (!parsed.success) {
      throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Invalid connection config', {
        issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }

    const saved = this.connectionsRepo.saveConnection(parsed.data as any)
    this.connectionManager.addConnection(saved.id, saved as any)
    broadcastAppChange('app:connections:changed')

    return { connection: sanitizeConnection(saved as any) }
  }
}

export class DeleteConnectionHandler {
  private connectionsRepo: ConnectionsRepository
  private tabsRepo: TabsRepository
  private connectionManager: ConnectionManager
  private errorHandler = getErrorHandler()

  constructor(connectionManager: ConnectionManager, deps: ConnectionCrudDeps = {}) {
    this.connectionManager = connectionManager
    this.connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
  }

  async handle(params: DeleteConnectionParams): Promise<{ success: boolean; resetProjects: number[] }> {
    const existing: StoredConnection | undefined = this.connectionsRepo.getConnection(params.connectionId)
    if (!existing) {
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Connection ${params.connectionId} not found`)
    }

    // Projects currently using this connection fall back to local
    const resetProjects: number[] = []
    for (const tab of this.tabsRepo.getAllTabs()) {
      if (tab.connection_id === params.connectionId) {
        resetProjectToLocal(tab.id, {
          tabsRepo: this.tabsRepo,
          connectionsRepo: this.connectionsRepo,
        })
        resetProjects.push(tab.id)
      }
    }

    const deleted = this.connectionsRepo.deleteConnection(params.connectionId)
    if (!deleted) {
      throw this.errorHandler.createError(
        MCPErrorCode.INTERNAL_ERROR,
        `Failed to delete connection ${params.connectionId}`
      )
    }

    this.connectionManager.removeConnection(params.connectionId)
    broadcastAppChange('app:connections:changed')
    broadcastAppChange('app:tabs:changed')

    return { success: true, resetProjects }
  }
}
