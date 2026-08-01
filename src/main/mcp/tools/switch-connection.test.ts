import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
}))

import { SwitchConnectionHandler } from './switch-connection'

describe('SwitchConnectionHandler Unit Tests', () => {
  let handler: SwitchConnectionHandler
  let mockConnectionManager: any
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue('PHP Version => 8.2.10'),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }

    mockConnectionManager = {
      getConnection: vi.fn(),
      getAllConnectionIds: vi.fn().mockReturnValue(['local-1']),
      getClient: vi.fn().mockReturnValue(mockClient),
      setActiveConnection: vi.fn(),
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
      generateConnectionId: vi.fn().mockReturnValue('docker-1'),
      addConnection: vi.fn(),
    }

    handler = new SwitchConnectionHandler(mockConnectionManager)
  })

  it('throws INVALID_PARAMETERS when neither connectionId nor connectionConfig are provided', async () => {
    await expect(handler.handle({})).rejects.toThrow(/Either "connectionId" or both/)
  })

  it('switches to an existing connection by ID', async () => {
    const existingConnection = { id: 'local-1', type: 'local', php: 'php' }
    mockConnectionManager.getConnection.mockReturnValue(existingConnection)

    const result = await handler.handle({ connectionId: 'local-1' })

    expect(result.success).toBe(true)
    expect(result.connectionType).toBe('local')
    expect(result.phpVersion).toBe('8.2.10')
    expect(mockConnectionManager.setActiveConnection).toHaveBeenCalledWith(existingConnection)
  })

  it('throws NOT_FOUND if connectionId does not exist', async () => {
    mockConnectionManager.getConnection.mockReturnValue(null)

    await expect(handler.handle({ connectionId: 'unknown-id' })).rejects.toThrow(
      /Connection with ID "unknown-id" not found/
    )
  })

  it('creates and switches to a new connection configuration', async () => {
    const result = await handler.handle({
      connectionType: 'docker',
      connectionConfig: { container_name: 'my-app-container', php: 'php' },
    })

    expect(result.success).toBe(true)
    expect(result.connectionType).toBe('docker')
    expect(mockConnectionManager.addConnection).toHaveBeenCalledWith('docker-1', expect.any(Object))
    expect(mockConnectionManager.setActiveConnection).toHaveBeenCalled()
  })

  it('validates required fields when creating new connection config', async () => {
    await expect(
      handler.handle({
        connectionType: 'ssh',
        connectionConfig: { host: 'example.com' }, // missing username
      })
    ).rejects.toThrow(/SSH connection requires "host" and "username"/)
  })
})
