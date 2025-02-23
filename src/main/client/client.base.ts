import { Client } from './client.interface'

export abstract class BaseClient implements Client {
  constructor(public connection: any) {}

  async connect(): Promise<void> {
    return
  }

  async setup(): Promise<void> {
    return
  }

  async action(type: string, data: any): Promise<any> {
    const action = `${type}Action`
    if (typeof (this as any)[action] === 'function') {
      return await (this as any)[action](data)
    }
    throw new Error(`Method ${type} does not exist.`)
  }

  abstract execute(code: string, loader?: string): Promise<string>

  abstract info(loader?: string): Promise<string>

  async disconnect(): Promise<void> {
    return
  }

  getConnection(): any {
    return this.connection
  }
}
