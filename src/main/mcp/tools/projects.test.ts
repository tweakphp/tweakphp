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

vi.mock('../../ipc/connections-ipc', () => ({
  syncConnectionsToMcpManagerIfActive: vi.fn(),
}))

import {
  ListProjectsHandler,
  CreateProjectHandler,
  UpdateProjectHandler,
  DeleteProjectHandler,
  RestoreProjectHandler,
  DuplicateProjectHandler,
  SetActiveProjectHandler,
} from './projects'
import { syncConnectionsToMcpManagerIfActive } from '../../ipc/connections-ipc'
import type { TabsRepository, TabRecord } from '../../db/repositories/tabs-repository'
import type { WorkspaceFoldersRepository } from '../../db/repositories/workspace-folders-repository'
import type { ConnectionsRepository } from '../../db/repositories/connections-repository'
import type { AppStorageRepository } from '../../db/repositories/app-storage-repository'

const makeTab = (overrides: Partial<TabRecord> = {}): TabRecord => ({
  id: 1,
  name: 'my-app',
  type: 'code',
  code: '<?php\n',
  path: '/home/user/code/my-app',
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
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  ...overrides,
})

describe('Project MCP handlers', () => {
  let mockTabsRepo: TabsRepository
  let mockFoldersRepo: WorkspaceFoldersRepository
  let mockConnectionsRepo: ConnectionsRepository
  let mockAppStorage: AppStorageRepository
  let tabs: TabRecord[]
  let storedConnections: Map<string, any>

  beforeEach(() => {
    vi.clearAllMocks()

    tabs = [
      makeTab({ id: 1, name: 'shop', folder_id: 3, color: 'rose', tag: 'prod', pinned: true }),
      makeTab({ id: 2, name: 'blog' }),
    ]

    mockTabsRepo = {
      getAllTabs: vi.fn().mockImplementation(() => tabs),
      getTab: vi.fn().mockImplementation((id: number) => tabs.find(tab => tab.id === Number(id))),
      saveTab: vi.fn().mockImplementation((tab: any) => {
        const index = tabs.findIndex(t => t.id === Number(tab.id))
        if (index === -1) {
          tabs.push(tab)
        } else {
          tabs[index] = tab
        }
      }),
      deleteTab: vi.fn().mockReturnValue(true),
      restoreTab: vi.fn().mockReturnValue(true),
    } as unknown as TabsRepository

    mockFoldersRepo = {
      getAllFolders: vi.fn().mockReturnValue([
        { id: 3, name: 'Work', position: 0, created_at: '', updated_at: '' },
      ]),
    } as unknown as WorkspaceFoldersRepository

    // in-memory store so saveConnection → getConnection round-trips like the real DB
    storedConnections = new Map()

    mockConnectionsRepo = {
      getConnection: vi.fn().mockImplementation((id: string) => storedConnections.get(String(id))),
      saveConnection: vi.fn().mockImplementation((connection: any) => {
        storedConnections.set(String(connection.id), { ...connection })
        return { ...connection }
      }),
      deleteConnection: vi.fn().mockReturnValue(true),
      getAllConnections: vi.fn().mockReturnValue([]),
    } as unknown as ConnectionsRepository

    mockAppStorage = {
      get: vi.fn().mockReturnValue([]),
      set: vi.fn(),
      remove: vi.fn(),
    } as unknown as AppStorageRepository
  })

  describe('ListProjectsHandler', () => {
    it('lists projects with folder names and metadata', async () => {
      const handler = new ListProjectsHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })
      const result = await handler.handle()

      expect(result.projects).toHaveLength(2)
      expect(result.projects[0]).toMatchObject({
        id: 1,
        name: 'shop',
        folderId: 3,
        folderName: 'Work',
        pinned: true,
        color: 'rose',
        tag: 'prod',
      })
      expect(result.projects[1]).toMatchObject({ id: 2, folderName: null })
    })

    it('filters projects by folder', async () => {
      const handler = new ListProjectsHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })
      const result = await handler.handle({ folderId: 3 })

      expect(result.projects).toHaveLength(1)
      expect(result.projects[0].id).toBe(1)
    })
  })

  describe('CreateProjectHandler', () => {
    it('creates a project with frontend defaults and assigns it to a folder', async () => {
      const handler = new CreateProjectHandler({
        tabsRepo: mockTabsRepo,
        foldersRepo: mockFoldersRepo,
        appStorage: mockAppStorage,
      })

      const project = await handler.handle({ path: '/home/user/code/api', folderId: 3, tag: 'dev' })

      expect(project.name).toBe('api')
      expect(project.folderId).toBe(3)
      expect(project.tag).toBe('dev')
      expect(project.execution).toBe('local')
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'api', path: '/home/user/code/api', type: 'code', tag: 'dev' })
      )
    })

    it('tracks the project in the recent projects history', async () => {
      const handler = new CreateProjectHandler({
        tabsRepo: mockTabsRepo,
        foldersRepo: mockFoldersRepo,
        appStorage: mockAppStorage,
      })

      await handler.handle({ path: '/home/user/code/api' })

      expect(mockAppStorage.set).toHaveBeenCalledWith('renderer.history', [{ path: '/home/user/code/api' }])
    })

    it('rejects an unknown folder', async () => {
      const handler = new CreateProjectHandler({
        tabsRepo: mockTabsRepo,
        foldersRepo: mockFoldersRepo,
        appStorage: mockAppStorage,
      })

      await expect(handler.handle({ path: '/x', folderId: 99 })).rejects.toThrow(/Folder 99 not found/)
    })

    it('requires a path', async () => {
      const handler = new CreateProjectHandler({
        tabsRepo: mockTabsRepo,
        foldersRepo: mockFoldersRepo,
        appStorage: mockAppStorage,
      })

      await expect(handler.handle({ path: '' })).rejects.toThrow(/"path" is required/)
    })
  })

  describe('UpdateProjectHandler', () => {
    it('updates name, color, tag, folder and pin state', async () => {
      const handler = new UpdateProjectHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })

      const result = await handler.handle({
        projectId: 2,
        name: 'renamed',
        color: 'blue',
        tag: 'staging',
        folderId: 3,
        pinned: true,
      })

      expect(result).toMatchObject({ id: 2, name: 'renamed', color: 'blue', tag: 'staging', folderId: 3, pinned: true })
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(expect.objectContaining({ id: 2, name: 'renamed' }))
    })

    it('writes new editor code into the project', async () => {
      const handler = new UpdateProjectHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })

      const result = await handler.handle({
        projectId: 2,
        code: '<?php\n\necho "written by MCP";',
      })

      expect(result.code).toBe('<?php\n\necho "written by MCP";')
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, code: '<?php\n\necho "written by MCP";' })
      )
    })

    it('unassigns the folder when folderId is null', async () => {
      const handler = new UpdateProjectHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })

      const result = await handler.handle({ projectId: 1, folderId: null })

      expect(result.folderId).toBeNull()
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(expect.objectContaining({ id: 1, folder_id: null }))
    })

    it('rejects an unknown project', async () => {
      const handler = new UpdateProjectHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })

      await expect(handler.handle({ projectId: 404, name: 'x' })).rejects.toThrow(/Project 404 not found/)
    })

    it('rejects an empty name', async () => {
      const handler = new UpdateProjectHandler({ tabsRepo: mockTabsRepo, foldersRepo: mockFoldersRepo })

      await expect(handler.handle({ projectId: 1, name: '   ' })).rejects.toThrow(/cannot be empty/)
    })
  })

  describe('DeleteProjectHandler', () => {
    it('trashes a project by default', async () => {
      const handler = new DeleteProjectHandler({ tabsRepo: mockTabsRepo })

      const result = await handler.handle({ projectId: 1 })

      expect(result).toMatchObject({ success: true, trashed: true })
      expect(mockTabsRepo.deleteTab).toHaveBeenCalledWith(1, false)
    })

    it('force deletes when requested and resyncs the cascaded connections', async () => {
      const handler = new DeleteProjectHandler({ tabsRepo: mockTabsRepo })

      const result = await handler.handle({ projectId: 1, force: true })

      expect(mockTabsRepo.deleteTab).toHaveBeenCalledWith(1, true)
      expect(result.trashed).toBe(false)
      // force delete cascades the project's connections: the MCP manager and
      // the renderer stores must be resynced
      expect(syncConnectionsToMcpManagerIfActive).toHaveBeenCalled()
    })

    it('soft delete does not resync connections', async () => {
      const handler = new DeleteProjectHandler({ tabsRepo: mockTabsRepo })

      await handler.handle({ projectId: 1 })

      expect(syncConnectionsToMcpManagerIfActive).not.toHaveBeenCalled()
    })
  })

  describe('RestoreProjectHandler', () => {
    it('restores a trashed project', async () => {
      const handler = new RestoreProjectHandler({ tabsRepo: mockTabsRepo })

      const result = await handler.handle({ projectId: 1 })

      expect(result.success).toBe(true)
      expect(mockTabsRepo.restoreTab).toHaveBeenCalledWith(1)
    })
  })

  describe('DuplicateProjectHandler', () => {
    it('duplicates the project with a fresh id and copies the vapor config owned by the clone', async () => {
      tabs = [makeTab({ id: 7, execution: 'vapor', connection_id: '7' })]
      ;(mockTabsRepo.getTab as any).mockImplementation((id: number) => tabs.find(tab => tab.id === Number(id)))
      storedConnections.set('7', {
        id: '7',
        type: 'vapor',
        environment: 'production',
        environments: ['production'],
        tab_id: 7,
      })

      const handler = new DuplicateProjectHandler({
        tabsRepo: mockTabsRepo,
        connectionsRepo: mockConnectionsRepo,
      })

      const result = await handler.handle({ projectId: 7 })

      expect(result.id).not.toBe(7)
      expect(result.execution).toBe('vapor')
      expect(mockConnectionsRepo.saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'vapor', environment: 'production', tab_id: result.id })
      )
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(expect.objectContaining({ execution: 'vapor' }))
    })

    it('duplicates the active ssh connection as a copy owned by the clone (never shared)', async () => {
      tabs = [makeTab({ id: 9, execution: 'ssh', connection_id: '101', ssh: { id: 101 } })]
      ;(mockTabsRepo.getTab as any).mockImplementation((id: number) => tabs.find(tab => tab.id === Number(id)))
      storedConnections.set('101', {
        id: '101',
        type: 'ssh',
        name: 'prod',
        host: '1.2.3.4',
        username: 'deploy',
        tab_id: 9,
      })

      const handler = new DuplicateProjectHandler({
        tabsRepo: mockTabsRepo,
        connectionsRepo: mockConnectionsRepo,
      })

      const result = await handler.handle({ projectId: 9 })

      expect(result.execution).toBe('ssh')
      expect(result.connectionId).not.toBe('101')

      // a copy was persisted, owned by the clone, source row untouched
      const savedCalls = (mockConnectionsRepo.saveConnection as any).mock.calls
      const copyCall = savedCalls.find((call: any[]) => call[0].type === 'ssh')
      expect(copyCall).toBeDefined()
      expect(copyCall[0].id).not.toBe('101')
      expect(copyCall[0].tab_id).toBe(result.id)
      expect(copyCall[0].host).toBe('1.2.3.4')

      // the clone tab references the copy
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: result.id, execution: 'ssh', connection_id: String(copyCall[0].id) })
      )
    })
  })

  describe('SetActiveProjectHandler', () => {
    it('marks the project as current and notifies the renderer', async () => {
      const handler = new SetActiveProjectHandler({ tabsRepo: mockTabsRepo, appStorage: mockAppStorage })

      const result = await handler.handle({ projectId: 2 })

      expect(result.success).toBe(true)
      expect(mockAppStorage.set).toHaveBeenCalledWith('renderer.current-tab', '2')
    })

    it('rejects an unknown project', async () => {
      const handler = new SetActiveProjectHandler({ tabsRepo: mockTabsRepo, appStorage: mockAppStorage })

      await expect(handler.handle({ projectId: 404 })).rejects.toThrow(/Project 404 not found/)
    })
  })
})
