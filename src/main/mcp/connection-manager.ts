/**
 * Connection Manager for MCP Server
 * Manages connections and integrates with TweakPHP's existing infrastructure
 */

import { LocalClient } from '../client/local'
import DockerClient from '../client/docker'
import { SSHClient } from '../client/ssh'
import KubectlClient from '../client/kubectl'
import { VaporClient } from '../client/vapor'
import { Client } from '../client/client.interface'
import { getSettings } from '../settings'
import { ConnectionsRepository } from '../db/repositories/connections-repository'
import { ConnectionType } from '../../types/connection.type'

export interface ConnectionConfig {
  type: ConnectionType
  name?: string
  [key: string]: any
}

export interface ConnectionSummary {
  id: string
  type: string
  name: string
  isActive: boolean
  details: Record<string, any>
}

export class ConnectionManager {
  private activeConnection: ConnectionConfig | null = null
  private storedConnections: Map<string, ConnectionConfig> = new Map()

  constructor() {
    // Initialize with default local connection from settings
    this.initializeDefaultConnection()
  }

  private initializeDefaultConnection(): void {
    const settings = getSettings()

    if (settings.php) {
      const localConnection: ConnectionConfig = {
        type: 'local',
        name: 'Local',
        php: settings.php,
        path: settings.laravelPath || process.cwd(),
      }

      this.activeConnection = localConnection
      this.storedConnections.set('local-default', localConnection)
    }

    try {
      const repo = new ConnectionsRepository()
      const savedConnections = repo.getAllConnections()
      for (const conn of savedConnections) {
        this.addConnection(conn.id, conn as any)
      }
      const active = repo.getActiveConnection()
      if (active) {
        this.setActiveConnection(active as any)
      }
    } catch (e) {
      // Ignore if DB not ready
    }
  }

  getActiveConnection(): ConnectionConfig | null {
    return this.activeConnection
  }

  setActiveConnection(connection: ConnectionConfig): void {
    this.activeConnection = this.normalizeConnection(connection)
  }

  addConnection(id: string, connection: ConnectionConfig): void {
    this.storedConnections.set(id, this.normalizeConnection(connection))
  }

  getConnection(id: string): ConnectionConfig | undefined {
    return this.storedConnections.get(id)
  }

  getAllConnectionIds(): string[] {
    return Array.from(this.storedConnections.keys())
  }

  getAllConnections(): Map<string, ConnectionConfig> {
    return new Map(this.storedConnections)
  }

  removeConnection(id: string): boolean {
    return this.storedConnections.delete(id)
  }

  public normalizeConnection(connection: ConnectionConfig): ConnectionConfig {
    if (!connection) return connection
    const normalized = { ...connection }
    if (normalized.type === 'docker') {
      if (!normalized.container_name) {
        if (normalized.container_id) normalized.container_name = String(normalized.container_id)
        else if (normalized.name) normalized.container_name = String(normalized.name)
      }
      const defaultPhp = normalized.php_path || normalized.php || 'php'
      normalized.php = normalized.php || defaultPhp
      normalized.php_path = normalized.php_path || defaultPhp

      const defaultPath = normalized.working_directory || normalized.path || '/var/www/html'
      normalized.path = normalized.path || defaultPath
      normalized.working_directory = normalized.working_directory || defaultPath
    }
    return normalized
  }

  getClient(connection: ConnectionConfig): Client {
    const normalized = this.normalizeConnection(connection)
    switch (normalized.type) {
      case 'local':
        return new LocalClient(normalized as any)
      case 'docker':
        return new DockerClient(normalized as any)
      case 'ssh':
        return new SSHClient(normalized as any)
      case 'kubectl':
        return new KubectlClient(normalized as any)
      case 'vapor':
        return new VaporClient(normalized as any)
      default:
        throw new Error(`Unsupported connection type: ${normalized.type}`)
    }
  }

  generateConnectionId(connection: ConnectionConfig): string {
    const timestamp = Date.now()
    const type = connection.type
    const name = this.getConnectionName(connection)
    return `${type}-${name}-${timestamp}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }

  getConnectionName(connection: ConnectionConfig): string {
    if (connection.name) return connection.name
    if (connection.container_name) return connection.container_name
    if (connection.type === 'local') return 'Local'
    return connection.type
  }

  getConnectionsList(): ConnectionSummary[] {
    const active = this.getActiveConnection()
    const list: ConnectionSummary[] = []

    for (const [id, conn] of this.storedConnections.entries()) {
      const activeName = active ? this.getConnectionName(active) : null
      const connName = this.getConnectionName(conn)
      const isActive = active !== null && active.type === conn.type && activeName === connName

      list.push({
        id,
        type: conn.type,
        name: connName,
        isActive,
        details: this.sanitizeConnectionDetails(conn),
      })
    }

    return list
  }

  private sanitizeConnectionDetails(connection: ConnectionConfig): Record<string, any> {
    const sanitized = { ...connection }

    delete sanitized.password
    delete sanitized.privateKey
    delete sanitized.passphrase
    delete sanitized.auth_token

    return sanitized
  }
}
