import type { ConnectionType } from '../../types/connection.type'
import type { StreamEvent } from './stream-output'

/**
 * Minimal shape shared by every connection config handled by the clients.
 */
export interface ClientConnection {
  type: ConnectionType
}

export interface Client {
  connect: () => Promise<void>
  setup: () => Promise<void>
  action: (type: string, data?: unknown) => Promise<unknown>
  execute: (code: string, loader?: string, projectPath?: string) => Promise<string>
  executeStreaming?: (code: string, loader?: string, onEvent?: (event: StreamEvent) => void) => Promise<void>
  info: (loader?: string) => Promise<string>
  disconnect: () => Promise<void>
  getConnection: () => ClientConnection
}
