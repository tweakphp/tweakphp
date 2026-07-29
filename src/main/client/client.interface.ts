export interface Client {
  connect: () => Promise<void>
  setup: () => Promise<void>
  action: (type: string, data?: any) => Promise<any>
  execute: (code: string, loader?: string, projectPath?: string) => Promise<string>
  executeStreaming?: (code: string, loader?: string, onEvent?: (event: any) => void) => Promise<void>
  info: (loader?: string) => Promise<string>
  disconnect: () => Promise<void>
  getConnection: () => any
}
