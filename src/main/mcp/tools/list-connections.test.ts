import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.14.0',
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

vi.mock('../../settings', () => ({
  settingsDir: '/tmp',
  settingsPath: '/tmp/settings.json',
  getSettings: () => ({ php: '/usr/local/bin/php', laravelPath: '/tmp/laravel' }),
}))

import { ListConnectionsHandler } from './list-connections'
import type { TabsRepository } from '../../db/repositories/tabs-repository'
import type { ConnectionsRepository } from '../../db/repositories/connections-repository'

describe('ListConnectionsHandler Unit Tests', () => {
  let handler: ListConnectionsHandler
  let mockConnectionManager: any
  let mockTabsRepo: TabsRepository
  let mockConnectionsRepo: ConnectionsRepository

  beforeEach(() => {
    mockConnectionManager = {
      getConnectionsList: vi.fn().mockReturnValue([
        {
          id: 'local-default',
          type: 'local',
          name: 'Local',
          details: { type: 'local', php: '/usr/bin/php' },
        },
        {
          id: 'ssh-1',
          type: 'ssh',
          name: 'project-ssh',
          details: { type: 'ssh', host: '1.2.3.4', tab_id: 1 },
        },
        {
          id: 'ssh-2',
          type: 'ssh',
          name: 'another-project-ssh',
          details: { type: 'ssh', host: '5.6.7.8', tab_id: 2 },
        },
      ]),
      getConnectionName: vi.fn().mockImplementation((connection: any) => connection?.name ?? connection?.type),
    }

    mockTabsRepo = {
      getTab: vi
        .fn()
        .mockImplementation((id: number) =>
          Number(id) === 1 ? { id: 1, name: 'shop', execution: 'ssh', connection_id: 'ssh-1' } : undefined
        ),
      getAllTabs: vi.fn().mockReturnValue([]),
      saveTab: vi.fn(),
    } as unknown as TabsRepository

    mockConnectionsRepo = {
      getConnection: vi
        .fn()
        .mockImplementation((id: string) =>
          id === 'ssh-1' ? { id: 'ssh-1', type: 'ssh', name: 'project-ssh', host: '1.2.3.4', tab_id: 1 } : undefined
        ),
      getConnectionsForTab: vi
        .fn()
        .mockImplementation((tabId: number) =>
          Number(tabId) === 1 ? [{ id: 'ssh-1', type: 'ssh', name: 'project-ssh', host: '1.2.3.4', tab_id: 1 }] : []
        ),
      getAllConnections: vi.fn().mockReturnValue([]),
      saveConnection: vi.fn(),
      deleteConnection: vi.fn(),
    } as unknown as ConnectionsRepository

    handler = new ListConnectionsHandler(mockConnectionManager, {
      tabsRepo: mockTabsRepo,
      connectionsRepo: mockConnectionsRepo,
    })
  })

  it('lists all connections with their owner project in the global view', async () => {
    const result = await handler.handle()

    expect(result.connections.length).toBe(3)
    expect(result.connections.find(c => c.id === 'ssh-1')?.projectId).toBe(1)
    expect(result.activeConnection).toBeUndefined()
  })

  it('filters connections by typeFilter in the global view', async () => {
    const result = await handler.handle({ typeFilter: 'ssh' })

    expect(result.connections.length).toBe(2)
    expect(result.activeConnection).toBeUndefined()
  })

  it('project view: lists only the project connections and resolves the active one', async () => {
    const result = await handler.handle({ projectId: 1 })

    expect(result.project).toBeDefined()
    expect(result.project?.id).toBe(1)
    expect(result.project?.execution).toBe('ssh')
    expect(result.project?.connection).toMatchObject({ connectionId: 'ssh-1', source: 'assigned' })
    expect(result.project?.projectConnection).toMatchObject({ type: 'ssh', name: 'project-ssh' })
    expect(result.project?.projectConnection?.details).not.toHaveProperty('password')

    // read from the repository by tab_id: only the project's own connections
    expect(mockConnectionsRepo.getConnectionsForTab).toHaveBeenCalledWith(1)
    expect(result.connections).toHaveLength(1)
    expect(result.connections[0].id).toBe('ssh-1')
    expect(result.connections[0].projectId).toBe(1)
    expect(result.connections[0].isActive).toBe(true)
  })

  it('project view: falls back to local-implicit when the project has no connection', async () => {
    ;(mockTabsRepo.getTab as any).mockImplementation((id: number) =>
      Number(id) === 3 ? { id: 3, name: 'localapp', execution: 'local', connection_id: null } : undefined
    )

    const result = await handler.handle({ projectId: 3 })

    expect(result.project?.connection.source).toBe('local-implicit')
    expect(result.project?.projectConnection).toMatchObject({ type: 'local' })
    expect(result.connections).toHaveLength(0)
  })

  it('project view: throws for an unknown project', async () => {
    await expect(handler.handle({ projectId: 404 })).rejects.toThrow(/Project with ID 404 not found/)
  })
})
