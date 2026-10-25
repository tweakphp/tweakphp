/**
 * List Connections Tool Handler
 * Lists available and configured execution environments.
 * With projectId: project-centric view — the project's own connections
 * (connections are atomic to a project) plus its resolved active connection.
 */

import { ListConnectionsParams } from './schemas'
import { ConnectionManager, ConnectionSummary } from '../connection-manager'
import { TabsRepository } from '../../db/repositories/tabs-repository'
import { ConnectionsRepository } from '../../db/repositories/connections-repository'
import { resolveProjectConnection } from './project-connection'
import { execSync } from 'child_process'

export interface DiscoveredEnvironment {
  type: string
  name: string
  details: Record<string, any>
}

export interface ProjectConnectionInfo {
  connectionId: string | null
  source: 'assigned' | 'legacy-docker' | 'legacy-ssh' | 'legacy-kubectl' | 'vapor' | 'local-implicit'
}

export interface ProjectView {
  id: number
  name: string
  execution: string
  connection: ProjectConnectionInfo
  projectConnection: ConnectionSummary | null
}

export interface ListConnectionsResult {
  project?: ProjectView
  /** Project view only: the connection assigned to the project (tab.connection_id) */
  activeConnection?: ConnectionSummary | null
  connections: (ConnectionSummary & { projectId?: number | null; isActive?: boolean })[]
  discovered?: DiscoveredEnvironment[]
}

export class ListConnectionsHandler {
  private connectionManager: ConnectionManager
  private tabsRepo?: TabsRepository
  private connectionsRepo?: ConnectionsRepository

  constructor(
    connectionManager: ConnectionManager,
    deps: { tabsRepo?: TabsRepository; connectionsRepo?: ConnectionsRepository } = {}
  ) {
    this.connectionManager = connectionManager
    this.tabsRepo = deps.tabsRepo
    this.connectionsRepo = deps.connectionsRepo
  }

  async handle(params?: ListConnectionsParams): Promise<ListConnectionsResult> {
    let connections: ListConnectionsResult['connections'] = this.connectionManager.getConnectionsList().map(c => ({
      ...c,
      projectId: (c.details?.tab_id ?? null) as number | null,
    }))

    if (params?.projectId !== undefined) {
      const projectId = params.projectId
      const tabsRepo = this.tabsRepo ?? new TabsRepository()
      const connectionsRepo = this.connectionsRepo ?? new ConnectionsRepository()

      const tab = tabsRepo.getTab(projectId)
      if (!tab) {
        throw new Error(`Project with ID ${projectId} not found`)
      }

      // Only the project's own connections, read straight from the repository
      // (atomic ownership; vapor rows of other projects are per-tab configs
      // and are excluded automatically by the tab_id filter)
      connections = connectionsRepo.getConnectionsForTab(projectId).map(connection => ({
        id: String(connection.id),
        type: connection.type,
        name: this.connectionManager.getConnectionName(connection as any),
        // in the project view "isActive" marks the project's active connection
        isActive: tab.connection_id === String(connection.id),
        details: this.sanitizeDetails(connection as any),
        projectId,
      }))

      if (params?.typeFilter) {
        connections = connections.filter(c => c.type === params.typeFilter)
      }

      const activeConnection = connections.find(c => c.isActive) || null

      const result: ListConnectionsResult = {
        project: this.buildProjectView(tab, connectionsRepo),
        activeConnection,
        connections,
      }

      if (params?.includeDiscovered) {
        result.discovered = await this.discoverEnvironment()
      }

      return result
    }

    // Global view (observability): every connection labelled with its owner
    if (params?.typeFilter) {
      connections = connections.filter(c => c.type === params.typeFilter)
    }

    const result: ListConnectionsResult = {
      connections,
    }

    if (params?.includeDiscovered) {
      result.discovered = await this.discoverEnvironment()
    }

    return result
  }

  private buildProjectView(tab: any, connectionsRepo: ConnectionsRepository): ProjectView {
    const resolved = resolveProjectConnection(tab.id, { tabsRepo: this.tabsRepo, connectionsRepo })
    const connection = resolved?.connection ?? null

    let source: ProjectConnectionInfo['source'] = 'local-implicit'
    if (tab.connection_id && connection && connection.type === tab.execution) {
      source = 'assigned'
    } else if (tab.execution === 'docker' && tab.docker) {
      source = 'legacy-docker'
    } else if (tab.execution === 'ssh' && tab.ssh) {
      source = 'legacy-ssh'
    } else if (tab.execution === 'kubectl' && tab.kubectl) {
      source = 'legacy-kubectl'
    } else if (tab.execution === 'vapor') {
      source = 'vapor'
    }

    const projectConnection: ConnectionSummary | null = connection
      ? {
          id: String(connection.id ?? tab.connection_id ?? ''),
          type: connection.type,
          name: this.connectionManager.getConnectionName(connection as any),
          details: this.sanitizeDetails(connection),
        }
      : null

    return {
      id: tab.id,
      name: tab.name,
      execution: tab.execution,
      connection: {
        connectionId: tab.connection_id ?? null,
        source,
      },
      projectConnection,
    }
  }

  private sanitizeDetails(connection: Record<string, any>): Record<string, any> {
    const sanitized = { ...connection }
    delete sanitized.password
    delete sanitized.privateKey
    delete sanitized.passphrase
    delete sanitized.auth_token
    delete sanitized.ssh
    return sanitized
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
