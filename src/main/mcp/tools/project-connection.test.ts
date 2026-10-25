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

import {
  resolveProjectConnection,
  getProjectTab,
  assignConnectionToProject,
  resetProjectToLocal,
} from './project-connection'
import type { TabsRepository, TabRecord } from '../../db/repositories/tabs-repository'
import type { ConnectionsRepository } from '../../db/repositories/connections-repository'

const makeTab = (overrides: Partial<TabRecord> = {}): TabRecord => ({
  id: 1,
  name: 'app',
  type: 'code',
  code: '<?php\n',
  path: '/projects/app',
  execution: 'local',
  connection_id: null,
  result: [],
  queries: [],
  pane: { code: 50, result: 50 },
  info: { name: '', php_version: '', version: '' },
  folder_id: null,
  pinned: false,
  color: null,
  tag: null,
  position: 0,
  deleted_at: null,
  ...overrides,
})

describe('resolveProjectConnection', () => {
  let mockTabsRepo: TabsRepository
  let mockConnectionsRepo: ConnectionsRepository
  let tab: TabRecord

  beforeEach(() => {
    tab = makeTab()
    mockTabsRepo = {
      getTab: vi.fn().mockImplementation((id: number) => (Number(id) === tab.id ? tab : undefined)),
    } as unknown as TabsRepository

    mockConnectionsRepo = {
      getConnection: vi.fn(),
    } as unknown as ConnectionsRepository
  })

  it('throws for an unknown project', () => {
    expect(() => getProjectTab(999, { tabsRepo: mockTabsRepo })).toThrow(/Project with ID 999 not found/)
  })

  it('resolves via tab.connection_id first', () => {
    tab.execution = 'ssh'
    tab.connection_id = '101'
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue({
      id: '101',
      type: 'ssh',
      host: '1.2.3.4',
      username: 'deploy',
    })

    const resolved = resolveProjectConnection(1, { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })

    expect(resolved?.connection).toMatchObject({ type: 'ssh', id: '101' })
    expect(mockConnectionsRepo.getConnection).toHaveBeenCalledWith('101')
  })

  it('attaches the ssh credentials to docker connections referencing ssh_id', () => {
    tab.execution = 'docker'
    tab.connection_id = '200'
    ;(mockConnectionsRepo.getConnection as any).mockImplementation((id: string) => {
      if (id === '200') {
        return { id: '200', type: 'docker', container_name: 'app', ssh_id: 101 }
      }
      if (id === '101') {
        return { id: '101', type: 'ssh', host: '1.2.3.4' }
      }
      return undefined
    })

    const resolved = resolveProjectConnection(1, { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })

    expect(resolved?.connection).toMatchObject({ type: 'docker', container_name: 'app' })
    expect((resolved?.connection as any).ssh).toMatchObject({ type: 'ssh', host: '1.2.3.4' })
  })

  it('falls back to the implicit local connection when connection_id points to a missing row', () => {
    tab.execution = 'ssh'
    tab.connection_id = '101'
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue(undefined)

    const resolved = resolveProjectConnection(1, { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })

    expect(resolved?.connection).toEqual({ type: 'local', path: '/projects/app', php: '/usr/local/bin/php' })
  })

  it('resolves vapor through the per-tab vapor connection row', () => {
    tab.execution = 'vapor'
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue({
      id: '1',
      type: 'vapor',
      environment: 'production',
      environments: ['production'],
    })

    const resolved = resolveProjectConnection(1, { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })

    expect(resolved?.connection).toMatchObject({ type: 'vapor', environment: 'production' })
  })

  it('falls back to the implicit local connection with settings php and project path', () => {
    const resolved = resolveProjectConnection(1, { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })

    expect(resolved?.connection).toEqual({ type: 'local', path: '/projects/app', php: '/usr/local/bin/php' })
  })
})

describe('assignConnectionToProject', () => {
  let mockTabsRepo: TabsRepository
  let mockConnectionsRepo: ConnectionsRepository

  beforeEach(() => {
    mockTabsRepo = {
      getTab: vi
        .fn()
        .mockImplementation((id: number) =>
          Number(id) === 42 ? { id: 42, execution: 'local', connection_id: null } : undefined
        ),
      saveTab: vi.fn(),
    } as unknown as TabsRepository

    mockConnectionsRepo = {
      getConnection: vi
        .fn()
        .mockImplementation((id: string) =>
          id === '101' ? { id: '101', type: 'ssh', host: '1.2.3.4', tab_id: 42 } : undefined
        ),
    } as unknown as ConnectionsRepository
  })

  it('assigns an owned connection to the project', () => {
    const projectId = assignConnectionToProject(42, '101', {
      tabsRepo: mockTabsRepo,
      connectionsRepo: mockConnectionsRepo,
    })

    expect(projectId).toBe(42)
    expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, execution: 'ssh', connection_id: '101' })
    )
  })

  it('rejects a connection owned by another project', () => {
    ;(mockConnectionsRepo.getConnection as any).mockReturnValue({ id: '101', type: 'ssh', tab_id: 7 })

    expect(() =>
      assignConnectionToProject(42, '101', { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })
    ).toThrow(/belongs to another project/)
  })

  it('rejects an unknown project or connection', () => {
    expect(() =>
      assignConnectionToProject(999, '101', { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })
    ).toThrow(/Project 999 not found/)

    expect(() =>
      assignConnectionToProject(42, '404', { tabsRepo: mockTabsRepo, connectionsRepo: mockConnectionsRepo })
    ).toThrow(/Connection 404 not found/)
  })
})

describe('resetProjectToLocal', () => {
  let mockTabsRepo: TabsRepository

  beforeEach(() => {
    mockTabsRepo = {
      getTab: vi
        .fn()
        .mockImplementation((id: number) =>
          Number(id) === 42 ? { id: 42, execution: 'ssh', connection_id: '101' } : undefined
        ),
      saveTab: vi.fn(),
    } as unknown as TabsRepository
  })

  it('resets the project to implicit local', () => {
    const result = resetProjectToLocal(42, { tabsRepo: mockTabsRepo })

    expect(result).toBe(true)
    expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, execution: 'local', connection_id: null })
    )
  })

  it('throws for an unknown project', () => {
    expect(() => resetProjectToLocal(999, { tabsRepo: mockTabsRepo })).toThrow(/Project 999 not found/)
  })
})
