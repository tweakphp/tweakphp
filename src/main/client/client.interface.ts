export interface Client {
  connect: () => Promise<void>
  setup: () => Promise<void>
  action: (type: string, data?: any) => Promise<any>
  execute: (code: string, loader?: string) => Promise<string>
  info: (loader?: string) => Promise<string>
  disconnect: () => Promise<void>
  getConnection: () => any
}
