/**
 * List Connections Tool Handler
 * Lists available and configured execution environments
 */

import { ListConnectionsParams } from './schemas'
import { ConnectionManager, ConnectionSummary } from '../connection-manager'
import { execSync } from 'child_process'

export interface DiscoveredEnvironment {
  type: string
  name: string
  details: Record<string, any>
}

export interface ListConnectionsResult {
  activeConnection: ConnectionSummary | null
  connections: ConnectionSummary[]
  discovered?: DiscoveredEnvironment[]
}

export class ListConnectionsHandler {
  private connectionManager: ConnectionManager

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager
  }

  async handle(params?: ListConnectionsParams): Promise<ListConnectionsResult> {
    let connections = this.connectionManager.getConnectionsList()

    if (params?.typeFilter) {
      connections = connections.filter(c => c.type === params.typeFilter)
    }

    const activeConnection = connections.find(c => c.isActive) || null

    const result: ListConnectionsResult = {
      activeConnection,
      connections,
    }

    if (params?.includeDiscovered) {
      result.discovered = await this.discoverEnvironment()
    }

    return result
  }

  private async discoverEnvironment(): Promise<DiscoveredEnvironment[]> {
    const discovered: DiscoveredEnvironment[] = []

    try {
      const output = execSync('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}"', {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const lines = output.trim().split('\n').filter(Boolean)

      for (const line of lines) {
        const [id, name, image] = line.split('|')
        discovered.push({
          type: 'docker',
          name,
          details: { container_id: id, image },
        })
      }
    } catch {
      // Docker discovery optional or unavailable
    }

    return discovered
  }
}
