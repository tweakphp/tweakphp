import { describe, it, expect } from 'vitest'
import { BaseClient } from './client.base'

class TestBaseClient extends BaseClient {
  constructor(connection: any) {
    super(connection)
  }

  async execute(code: string, loader?: string): Promise<string> {
    return `execute: ${code}`
  }

  async info(loader?: string): Promise<string> {
    return 'info'
  }

  // A mock action for action method testing
  async testAction(data: any): Promise<any> {
    return `data: ${data}`
  }
}

describe('BaseClient', () => {
  it('connect, setup, and disconnect resolve successfully by default', async () => {
    const client = new TestBaseClient({ type: 'test' })
    await expect(client.connect()).resolves.toBeUndefined()
    await expect(client.setup()).resolves.toBeUndefined()
    await expect(client.disconnect()).resolves.toBeUndefined()
  })

  it('getConnection returns connection config', () => {
    const conn = { type: 'test', path: '/path' }
    const client = new TestBaseClient(conn)
    expect(client.getConnection()).toBe(conn)
  })

  it('action calls corresponding Action method dynamically', async () => {
    const client = new TestBaseClient({ type: 'test' })
    const result = await client.action('test', 'hello')
    expect(result).toBe('data: hello')
  })

  it('action throws error if method does not exist', async () => {
    const client = new TestBaseClient({ type: 'test' })
    await expect(client.action('nonexistent', 'data')).rejects.toThrow('Method nonexistent does not exist.')
  })
})
