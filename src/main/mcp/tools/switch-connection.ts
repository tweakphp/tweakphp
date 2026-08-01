/**
 * Switch Connection Tool Handler
 * Switches between different execution environments
 */

import { SwitchConnectionParams } from './schemas'
import { MCPErrorCode } from '../types'
import { ConnectionManager } from '../connection-manager'
import { getErrorHandler } from '../error-handler'
import { getSettings } from '../../settings'

interface SwitchConnectionResult {
  success: boolean
  connectionType: string
  connectionName: string
  phpVersion?: string
  details: Record<string, any>
}

export class SwitchConnectionHandler {
  private connectionManager: ConnectionManager
  private errorHandler = getErrorHandler()

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager
  }

  async handle(params: SwitchConnectionParams): Promise<SwitchConnectionResult> {
    // Case 1: Switch to existing connection by ID
    if (params.connectionId) {
      return await this.switchToExistingConnection(params.connectionId)
    }

    // Case 2: Create new connection from config
    if (params.connectionType && params.connectionConfig) {
      return await this.createAndSwitchConnection(params.connectionType, params.connectionConfig)
    }

    // Invalid parameters
    throw this.errorHandler.createError(
      MCPErrorCode.INVALID_PARAMETERS,
      'Either "connectionId" or both "connectionType" and "connectionConfig" must be provided'
    )
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

      // Set as active connection
      this.connectionManager.setActiveConnection(connection)

      return {
        success: true,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
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
    connectionConfig: Record<string, unknown>
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

      // Set as active connection
      this.connectionManager.setActiveConnection(connection)

      // Generate an ID and store it
      const connectionId = this.connectionManager.generateConnectionId(connection)
      this.connectionManager.addConnection(connectionId, connection)

      return {
        success: true,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
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
        if (!connection.container_name) {
          throw this.errorHandler.createError(
            MCPErrorCode.INVALID_PARAMETERS,
            'Docker connection requires "container_name"'
          )
        }
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
