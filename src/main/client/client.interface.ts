import type { ChildProcess } from 'child_process'
import type { StopSignal } from '../utils/stop-command'

export interface Client {
  connect: () => Promise<void>
  setup: () => Promise<void>
  action: (type: string, data?: any) => Promise<any>
  execute: (code: string, loader?: string, projectPath?: string) => Promise<string>
  executeStreaming?: (
    code: string,
    loader?: string,
    onEvent?: (event: any) => void,
    onChild?: (child: ChildProcess) => void
  ) => Promise<void>
  stop?: (pid?: number, signal?: StopSignal) => Promise<void>
  /** Gate 1 for transports without a local child handle (ssh streams): false once the stream is gone */
  isRunning?: () => boolean
  info: (loader?: string) => Promise<string>
  disconnect: () => Promise<void>
  getConnection: () => any
}
