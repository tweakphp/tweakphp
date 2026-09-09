import { describe, it, expect } from 'vitest'
import { BaseClient, ClientActionHandler } from './client.base'
import { ClientConnection } from './client.interface'

class TestBaseClient extends BaseClient {
  protected actions: Record<string, ClientActionHandler> = {
    test: async (data: unknown) => `data: ${data}`,
  }

  constructor(connection: ClientConnection) {
    super(connection)
  }

  async execute(_code: string): Promise<string> {
    return 'execute'
  }

  async info(): Promise<string> {
    return 'info'
  }
}

describe('BaseClient', () => {
  it('connect, setup, and disconnect resolve successfully by default', async () => {
    const client = new TestBaseClient({ type: 'local' })
    await expect(client.connect()).resolves.toBeUndefined()
    await expect(client.setup()).resolves.toBeUndefined()
    await expect(client.disconnect()).resolves.toBeUndefined()
  })

  it('getConnection returns connection config', () => {
    const conn = { type: 'local' as const, path: '/path' }
    const client = new TestBaseClient(conn)
    expect(client.getConnection()).toBe(conn)
  })

  it('action calls the handler registered in the action map', async () => {
    const client = new TestBaseClient({ type: 'local' })
    const result = await client.action('test', 'hello')
    expect(result).toBe('data: hello')
  })

  it('action throws error if no handler is registered', async () => {
    const client = new TestBaseClient({ type: 'local' })
    await expect(client.action('nonexistent', 'data')).rejects.toThrow('Method nonexistent does not exist.')
  })
})
