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

export interface ConnectionConfig {
  type: 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'
  name?: string
  [key: string]: any
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
        path: process.cwd(),
      }

      this.activeConnection = localConnection
      this.storedConnections.set('local-default', localConnection)
    }
  }

  getActiveConnection(): ConnectionConfig | null {
    return this.activeConnection
  }

  setActiveConnection(connection: ConnectionConfig): void {
    this.activeConnection = connection
  }

  addConnection(id: string, connection: ConnectionConfig): void {
    this.storedConnections.set(id, connection)
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

  getClient(connection: ConnectionConfig): Client {
    switch (connection.type) {
      case 'local':
        return new LocalClient(connection)
      case 'docker':
        return new DockerClient(connection)
      case 'ssh':
        return new SSHClient(connection)
      case 'kubectl':
        return new KubectlClient(connection)
      case 'vapor':
        return new VaporClient(connection)
      default:
        throw new Error(`Unsupported connection type: ${connection.type}`)
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
}
