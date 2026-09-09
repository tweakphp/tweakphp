import { Client } from './client.interface'
import type { ClientConnectionConfig } from '../../types/client-connection.type'
import { LocalClient } from './local'
import DockerClient from './docker'
import { SSHClient } from './ssh'
import { VaporClient } from './vapor'
import KubectlClient from './kubectl'

/**
 * Single client factory shared by the IPC router (client/index.ts) and the MCP
 * ConnectionManager so every caller builds clients the same way.
 */
export const createClient = (connection: ClientConnectionConfig): Client => {
  if (!connection) {
    throw new Error('Connection is required')
  }

  switch (connection.type) {
    case 'local':
      return new LocalClient(connection)
    case 'docker':
      return new DockerClient(connection)
    case 'vapor':
      return new VaporClient(connection)
    case 'ssh':
      return new SSHClient(connection)
    case 'kubectl':
      return new KubectlClient(connection)
    default:
      throw new Error(`Unsupported connection type: ${(connection as { type: string }).type}`)
  }
}
