import { Client, ClientConnection } from './client.interface'

export type ClientActionHandler = (data: unknown) => Promise<unknown>

export abstract class BaseClient implements Client {
  /**
   * Actions callable through `action(type, data)`. Subclasses override this map
   * with the handlers they expose (no more `this['${type}Action']` reflection).
   */
  protected actions: Record<string, ClientActionHandler> = {}

  constructor(public connection: ClientConnection) {}

  async connect(): Promise<void> {
    return
  }

  async setup(): Promise<void> {
    return
  }

  async action(type: string, data?: unknown): Promise<unknown> {
    const handler = this.actions[type]
    if (!handler) {
      throw new Error(`Method ${type} does not exist.`)
    }
    return await handler(data)
  }

  abstract execute(code: string, loader?: string, projectPath?: string): Promise<string>

  abstract info(loader?: string): Promise<string>

  async disconnect(): Promise<void> {
    return
  }

  getConnection(): ClientConnection {
    return this.connection
  }
}
