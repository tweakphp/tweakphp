import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
}))

// db_manager loads better-sqlite3 at import time: mock it so unit tests
// never load the native module (compiled for Electron, not for Node)
vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {
    prepare = vi.fn().mockReturnValue({ get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() })
    transaction = vi.fn().mockImplementation((fn: any) => fn)
    pragma = vi.fn()
  },
}))

import { SwitchConnectionHandler } from './switch-connection'
import type { ConnectionsRepository } from '../../db/repositories/connections-repository'
import type { TabsRepository } from '../../db/repositories/tabs-repository'

describe('SwitchConnectionHandler Unit Tests', () => {
  let handler: SwitchConnectionHandler
  let mockConnectionManager: any
  let mockClient: any
  let mockConnectionsRepo: ConnectionsRepository
  let mockTabsRepo: TabsRepository

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
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
      generateConnectionId: vi.fn().mockReturnValue('docker-1'),
      addConnection: vi.fn(),
    }

    mockConnectionsRepo = {
      getConnection: vi.fn(),
      saveConnection: vi.fn().mockImplementation((connection: any) => connection),
      deleteConnection: vi.fn(),
      getAllConnections: vi.fn().mockReturnValue([]),
    } as unknown as ConnectionsRepository

    mockTabsRepo = {
      getTab: vi.fn(),
      getAllTabs: vi.fn().mockReturnValue([]),
      saveTab: vi.fn(),
    } as unknown as TabsRepository

    handler = new SwitchConnectionHandler(mockConnectionManager, {
      connectionsRepo: mockConnectionsRepo,
      tabsRepo: mockTabsRepo,
    })
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
    expect(mockClient.connect).toHaveBeenCalled()
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
  })

  it('does not persist a row when creating a local connection (implicit execution)', async () => {
    const result = await handler.handle({
      connectionType: 'local',
      connectionConfig: { php: 'php', path: '/app' },
    })

    expect(result.success).toBe(true)
    expect(result.connectionType).toBe('local')
    expect(mockConnectionsRepo.saveConnection).not.toHaveBeenCalled()
  })

  it('validates required fields when creating new connection config', async () => {
    await expect(
      handler.handle({
        connectionType: 'ssh',
        connectionConfig: { host: 'example.com' }, // missing username
      })
    ).rejects.toThrow(/SSH connection requires "host" and "username"/)
  })

  it('persists the created connection unassigned when no projectId is provided', async () => {
    await handler.handle({
      connectionType: 'docker',
      connectionConfig: { container_name: 'persisted-container', php: 'php' },
    })

    expect(mockConnectionsRepo.saveConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'docker-1', tab_id: null })
    )
  })

  it('assigns the switched connection to a project when projectId is provided', async () => {
    const existingConnection = { id: '101', type: 'ssh', name: 'prod', tab_id: 42 }
    mockConnectionManager.getConnection.mockReturnValue(existingConnection)
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue(existingConnection)
    ;(mockTabsRepo.getTab as any).mockReturnValue({ id: 42, execution: 'local', connection_id: null })

    const result = await handler.handle({ connectionId: '101', projectId: 42 })

    expect(result.assignedToProject).toBe(42)
    expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, execution: 'ssh', connection_id: '101', ssh: { id: 101 } })
    )
  })

  it('rejects switching a project to a connection owned by another project', async () => {
    const existingConnection = { id: '101', type: 'ssh', name: 'prod', tab_id: 7 }
    mockConnectionManager.getConnection.mockReturnValue(existingConnection)
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue(existingConnection)
    ;(mockTabsRepo.getTab as any).mockReturnValue({ id: 42, execution: 'local', connection_id: null })

    await expect(handler.handle({ connectionId: '101', projectId: 42 })).rejects.toThrow(/belongs to another project/)
  })

  it('disconnects a project back to implicit local with connectionType local + projectId', async () => {
    ;(mockTabsRepo.getTab as any).mockReturnValue({ id: 42, execution: 'ssh', connection_id: '101', ssh: { id: 101 } })

    const result = await handler.handle({ connectionType: 'local', projectId: 42 })

    expect(result.success).toBe(true)
    expect(result.connectionType).toBe('local')
    expect(result.assignedToProject).toBe(42)
    expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, execution: 'local', connection_id: null })
    )
  })

  it('throws NOT_FOUND when projectId refers to an unknown project', async () => {
    const existingConnection = { id: '101', type: 'ssh', name: 'prod', tab_id: 42 }
    mockConnectionManager.getConnection.mockReturnValue(existingConnection)
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue(existingConnection)
    ;(mockTabsRepo.getTab as any).mockReturnValue(undefined)

    await expect(handler.handle({ connectionId: '101', projectId: 999 })).rejects.toThrow(/Project 999 not found/)
  })
})
