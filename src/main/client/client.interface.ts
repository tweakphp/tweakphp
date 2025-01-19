export interface Client {
  connect: () => Promise<void>
  setup: () => Promise<void>
  action: (type: string, data?: any) => Promise<any>
  execute: (code: string) => Promise<string>
  info: () => Promise<string>
  disconnect: () => Promise<void>
  getConnection: () => any
}
