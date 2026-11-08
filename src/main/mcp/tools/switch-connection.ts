/**
 * Switch Connection Tool Handler
 * Switches between different execution environments
 */

import { SwitchConnectionParams } from './schemas'
import { MCPErrorCode } from '../types'
import { ConnectionManager } from '../connection-manager'
import { getErrorHandler } from '../error-handler'
import { getSettings } from '../../settings'
import { ConnectionsRepository } from '../../db/repositories/connections-repository'
import { TabsRepository } from '../../db/repositories/tabs-repository'
import { broadcastAppChange } from '../../ipc/broadcast'
import { assignConnectionToProject, resetProjectToLocal } from './project-connection'

interface SwitchConnectionResult {
  success: boolean
  connectionType: string
  connectionName: string
  connectionId?: string
  phpVersion?: string
  assignedToProject?: number
  details: Record<string, any>
}

export class SwitchConnectionHandler {
  private connectionManager: ConnectionManager
  private connectionsRepo: ConnectionsRepository
  private tabsRepo: TabsRepository
  private errorHandler = getErrorHandler()

  constructor(
    connectionManager: ConnectionManager,
    deps: { connectionsRepo?: ConnectionsRepository; tabsRepo?: TabsRepository } = {}
  ) {
    this.connectionManager = connectionManager
    this.connectionsRepo = deps.connectionsRepo ?? new ConnectionsRepository()
    this.tabsRepo = deps.tabsRepo ?? new TabsRepository()
  }

  async handle(params: SwitchConnectionParams): Promise<SwitchConnectionResult> {
    // Disconnect shortcut: switch a project back to the implicit local connection
    if (
      params.projectId !== undefined &&
      !params.connectionId &&
      params.connectionType === 'local' &&
      !params.connectionConfig
    ) {
      resetProjectToLocal(params.projectId, {
        tabsRepo: this.tabsRepo,
        connectionsRepo: this.connectionsRepo,
      })
      return {
        success: true,
        connectionType: 'local',
        connectionName: 'Local',
        assignedToProject: params.projectId,
        details: { type: 'local', disconnected: true },
      }
    }

    let result: SwitchConnectionResult

    // Pre-validate project and ownership before spending a connection attempt
    if (params.connectionId && params.projectId !== undefined) {
      if (!this.tabsRepo.getTab(params.projectId)) {
        throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Project ${params.projectId} not found`)
      }
      const owned = this.connectionsRepo.getConnection(params.connectionId)
      if (!owned) {
        throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Connection ${params.connectionId} not found`)
      }
      if (owned.tab_id !== null && owned.tab_id !== undefined && Number(owned.tab_id) !== params.projectId) {
        throw this.errorHandler.createError(
          MCPErrorCode.INVALID_PARAMETERS,
          `Connection ${params.connectionId} belongs to another project (connections are atomic to a project)`,
          { connectionId: params.connectionId, projectId: params.projectId, ownerProjectId: owned.tab_id }
        )
      }
    }

    // Case 1: Switch to existing connection by ID
    if (params.connectionId) {
      result = await this.switchToExistingConnection(params.connectionId)
    } else if (params.connectionType && params.connectionConfig) {
      // Case 2: Create new connection from config
      result = await this.createAndSwitchConnection(params.connectionType, params.connectionConfig, params.projectId)
    } else {
      // Invalid parameters
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Either "connectionId" or both "connectionType" and "connectionConfig" must be provided'
      )
    }

    // Optionally assign the connection as the active connection of a project.
    // assignConnectionToProject validates that the connection belongs to the project.
    if (params.projectId !== undefined) {
      result.assignedToProject = assignConnectionToProject(
        params.projectId,
        result.connectionId ?? params.connectionId!,
        {
          tabsRepo: this.tabsRepo,
          connectionsRepo: this.connectionsRepo,
        }
      )
    }

    return result
  }

  private async switchToExistingConnection(connectionId: string): Promise<SwitchConnectionResult> {
    const connection = this.connectionManager.getConnection(connectionId)

    if (!connection) {
      const availableConnections = this.connectionManager.getAllConnectionIds()
      throw this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Connection with ID "${connectionId}" not found`, {
        connectionId,
        availableConnections,
      })
    }

    // Test the connection with retry logic
    const client = this.connectionManager.getClient(connection)

    try {
      await this.errorHandler.executeWithRetry(
        () => client.connect(),
        'switch_connection:connect',
        3, // max 3 retries for connection switching
        2000 // 2 second base delay
      )

      // Try to get PHP version
      let phpVersion: string | undefined
      try {
        const info = await client.info()
        phpVersion = this.extractPhpVersion(info)
      } catch {
        // PHP version retrieval is optional
      }

      await client.disconnect()

      return {
        success: true,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        connectionId,
        phpVersion,
        details: this.sanitizeConnectionDetails(connection),
      }
    } catch (error: any) {
      const mcpError = this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        `Failed to connect to "${connectionId}"`,
        {
          connectionId,
          reason: error.message,
        }
      )
      throw this.errorHandler.enhanceErrorWithTroubleshooting(mcpError, connection.type)
    }
  }

  private async createAndSwitchConnection(
    connectionType: string,
    connectionConfig: Record<string, unknown>,
    projectId?: number
  ): Promise<SwitchConnectionResult> {
    // Validate connection type
    const validTypes: Array<'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'> = [
      'local',
      'docker',
      'ssh',
      'kubectl',
      'vapor',
    ]
    if (!validTypes.includes(connectionType as any)) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        `Invalid connection type "${connectionType}"`,
        {
          validTypes,
        }
      )
    }

    // Build connection object
    const connection = {
      type: connectionType as 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor',
      ...connectionConfig,
    }

    // Validate required fields based on type
    this.validateConnectionConfig(connection)

    // Test the connection with retry logic
    const client = this.connectionManager.getClient(connection)

    try {
      await this.errorHandler.executeWithRetry(
        () => client.connect(),
        'switch_connection:create',
        3, // max 3 retries for new connection
        2000 // 2 second base delay
      )

      // Try to get PHP version
      let phpVersion: string | undefined
      try {
        const info = await client.info()
        phpVersion = this.extractPhpVersion(info)
      } catch {
        // PHP version retrieval is optional
      }

      await client.disconnect()

      // Local execution is implicit: keep the connection in-memory only
      // (no dead row in the connections table)
      if (connection.type === 'local') {
        const localId = this.connectionManager.generateConnectionId(connection)
        this.connectionManager.addConnection(localId, connection)
        return {
          success: true,
          connectionType: connection.type,
          connectionName: this.connectionManager.getConnectionName(connection),
          connectionId: localId,
          phpVersion,
          details: this.sanitizeConnectionDetails(connection),
        }
      }

      // Register the connection (in-memory + persisted like the frontend does).
      // With a projectId the connection is owned by that project (atomic ownership);
      // without one it is stored unassigned (visible only in the global MCP list).
      const connectionId = this.connectionManager.generateConnectionId(connection)
      this.connectionManager.addConnection(connectionId, connection)
      const saved = this.connectionsRepo.saveConnection({
        ...connection,
        id: connectionId,
        tab_id: projectId ?? null,
      } as any)
      broadcastAppChange('app:connections:changed')

      return {
        success: true,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        connectionId: saved.id,
        phpVersion,
        details: this.sanitizeConnectionDetails(connection),
      }
    } catch (error: any) {
      const mcpError = this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        `Failed to establish ${connectionType} connection`,
        {
          reason: error.message,
        }
      )
      throw this.errorHandler.enhanceErrorWithTroubleshooting(mcpError, connectionType)
    }
  }

  private validateConnectionConfig(connection: any): void {
    switch (connection.type) {
      case 'local':
        if (!connection.php) {
          throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Local connection requires "php" path')
        }
        if (!connection.path) {
          connection.path = getSettings().laravelPath || process.cwd()
        }
        break
      case 'docker':
        if (!connection.container_name && !connection.container_id && !connection.name) {
          throw this.errorHandler.createError(
            MCPErrorCode.INVALID_PARAMETERS,
            'Docker connection requires "container_name"'
          )
        }
        if (!connection.container_name) {
          connection.container_name = connection.container_id || connection.name
        }
        connection.php = connection.php || connection.php_path || 'php'
        connection.php_path = connection.php_path || connection.php || 'php'
        connection.path = connection.path || connection.working_directory || '/var/www/html'
        connection.working_directory = connection.working_directory || connection.path || '/var/www/html'
        break
      case 'ssh':
        if (!connection.host || !connection.username) {
          throw this.errorHandler.createError(
            MCPErrorCode.INVALID_PARAMETERS,
            'SSH connection requires "host" and "username"'
          )
        }
        break
      case 'kubectl':
        if (!connection.pod) {
          throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Kubectl connection requires "pod"')
        }
        break
      case 'vapor':
        if (!connection.environment) {
          throw this.errorHandler.createError(
            MCPErrorCode.INVALID_PARAMETERS,
            'Vapor connection requires "environment"'
          )
        }
        break
    }
  }

  private sanitizeConnectionDetails(connection: any): Record<string, any> {
    const sanitized = { ...connection }

    // Remove sensitive information
    delete sanitized.password
    delete sanitized.privateKey
    delete sanitized.passphrase
    delete sanitized.auth_token

    return sanitized
  }

  private extractPhpVersion(info: string): string | undefined {
    const match = info.match(/PHP Version => ([\d.]+)/)
    return match ? match[1] : undefined
  }
}
