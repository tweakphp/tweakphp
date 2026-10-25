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

import {
  CreateConnectionHandler,
  UpdateConnectionHandler,
  DeleteConnectionHandler,
} from './connections-crud'
import type { ConnectionsRepository } from '../../db/repositories/connections-repository'
import type { TabsRepository } from '../../db/repositories/tabs-repository'

describe('Connection CRUD MCP handlers (project-atomic connections)', () => {
  let mockConnectionsRepo: ConnectionsRepository
  let mockTabsRepo: TabsRepository
  let mockConnectionManager: any
  let storedConnections: Map<string, any>

  const makeTab = (id: number) => ({ id, name: `project-${id}`, execution: 'local', connection_id: null })

  beforeEach(() => {
    mockConnectionManager = {
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
    }

    // in-memory store so saveConnection → getConnection round-trips like the real DB
    storedConnections = new Map()

    mockConnectionsRepo = {
      getAllConnections: vi.fn().mockReturnValue([]),
      getConnectionsForTab: vi.fn().mockReturnValue([]),
      getConnection: vi.fn().mockImplementation((id: string) => storedConnections.get(String(id))),
      saveConnection: vi.fn().mockImplementation((connection: any) => {
        storedConnections.set(String(connection.id), { ...connection })
        return { ...connection }
      }),
      deleteConnection: vi.fn().mockImplementation((id: string) => storedConnections.delete(String(id))),
    } as unknown as ConnectionsRepository

    mockTabsRepo = {
      getTab: vi.fn().mockImplementation((id: number) => makeTab(id)),
      getAllTabs: vi.fn().mockReturnValue([makeTab(1), makeTab(2)]),
      saveTab: vi.fn(),
      deleteTab: vi.fn().mockReturnValue(true),
      restoreTab: vi.fn().mockReturnValue(true),
    } as unknown as TabsRepository
  })

  describe('CreateConnectionHandler', () => {
    it('requires projectId (connections are atomic to a project)', async () => {
      const handler = new CreateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      await expect(
        handler.handle({
          type: 'docker',
          config: { container_name: 'x' },
        } as any)
      ).rejects.toThrow(/"projectId" is required/)
    })

    it('creates a project-owned connection and assigns it as active', async () => {
      const handler = new CreateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      const result = await handler.handle({
        projectId: 1,
        type: 'ssh',
        config: {
          name: 'production',
          color: 'rose',
          host: '1.2.3.4',
          port: 22,
          username: 'deploy',
          auth_type: 'password',
          password: 'secret-password',
          path: '/var/www',
        },
      })

      expect(result.connection).toMatchObject({ type: 'ssh', name: 'production', tab_id: 1 })
      expect(result.connection).not.toHaveProperty('password')
      expect(result.assignedToProject).toBe(1)
      expect(mockConnectionsRepo.saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ssh', tab_id: 1 })
      )
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, execution: 'ssh' })
      )
    })

    it('creates a docker connection owned by the project', async () => {
      const handler = new CreateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      const result = await handler.handle({
        projectId: 2,
        type: 'docker',
        config: {
          name: 'sail',
          container_id: 'abc123',
          container_name: 'laravel.test',
          working_directory: '/var/www/html',
        },
      })

      expect(result.connection).toMatchObject({ type: 'docker', container_name: 'laravel.test', tab_id: 2 })
    })

    it('local type resets the project to implicit local without persisting a row', async () => {
      const handler = new CreateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      const result = await handler.handle({
        projectId: 1,
        type: 'local',
        config: { php: '/usr/local/bin/php', path: '/projects/app' },
      })

      expect(result.connection).toMatchObject({ type: 'local', php: '/usr/local/bin/php' })
      expect(result.assignedToProject).toBe(1)
      // local is implicit: no dead row in the connections table
      expect(mockConnectionsRepo.saveConnection).not.toHaveBeenCalled()
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, execution: 'local', connection_id: null })
      )
    })

    it('rejects an invalid connection config', async () => {
      const handler = new CreateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      await expect(
        handler.handle({
          projectId: 1,
          type: 'ssh',
          config: { name: 'broken' }, // missing host/port/username
        })
      ).rejects.toThrow(/Invalid connection config/)
    })

    it('rejects an unknown project', async () => {
      ;(mockTabsRepo.getTab as any).mockReturnValue(undefined)
      const handler = new CreateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      await expect(
        handler.handle({ projectId: 404, type: 'docker', config: { container_name: 'x', container_id: 'y', working_directory: '/w' } })
      ).rejects.toThrow(/Project 404 not found/)
    })
  })

  describe('UpdateConnectionHandler', () => {
    it('merges changes into the stored connection keeping ownership', async () => {
      storedConnections.set('101', {
        id: '101',
        type: 'ssh',
        name: 'production',
        host: '1.2.3.4',
        port: 22,
        username: 'deploy',
        auth_type: 'password',
        password: 'old',
        path: '/var/www',
        tab_id: 1,
      })
      const handler = new UpdateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
      })

      const result = await handler.handle({ connectionId: '101', changes: { host: '5.6.7.8' } })

      expect(result.connection).toMatchObject({ id: '101', host: '5.6.7.8', tab_id: 1 })
      expect(result.connection).not.toHaveProperty('password')
    })

    it('rejects changing the connection type', async () => {
      storedConnections.set('101', { id: '101', type: 'ssh', host: 'x', tab_id: 1 })
      const handler = new UpdateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
      })

      await expect(
        handler.handle({ connectionId: '101', changes: { type: 'docker' } })
      ).rejects.toThrow(/type cannot be changed/)
    })

    it('rejects changing the connection ownership', async () => {
      storedConnections.set('101', { id: '101', type: 'ssh', host: 'x', tab_id: 1 })
      const handler = new UpdateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
      })

      await expect(
        handler.handle({ connectionId: '101', changes: { tab_id: 2 } })
      ).rejects.toThrow(/ownership cannot be changed/)
    })

    it('rejects updating an unknown connection', async () => {
      const handler = new UpdateConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
      })

      await expect(handler.handle({ connectionId: '404', changes: { name: 'x' } })).rejects.toThrow(
        /Connection 404 not found/
      )
    })
  })

  describe('DeleteConnectionHandler', () => {
    it('deletes the connection, resets the projects using it and syncs the manager', async () => {
      storedConnections.set('101', { id: '101', type: 'ssh', tab_id: 1 })
      ;(mockTabsRepo.getAllTabs as any).mockReturnValue([
        { id: 1, name: 'owner', execution: 'ssh', connection_id: '101' },
        { id: 2, name: 'other', execution: 'local', connection_id: null },
      ])
      const handler = new DeleteConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      const result = await handler.handle({ connectionId: '101' })

      expect(result.success).toBe(true)
      expect(result.resetProjects).toEqual([1])
      expect(mockTabsRepo.saveTab).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, execution: 'local', connection_id: null })
      )
      expect(mockConnectionsRepo.deleteConnection).toHaveBeenCalledWith('101')
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith('101')
    })

    it('rejects deleting an unknown connection', async () => {
      const handler = new DeleteConnectionHandler(mockConnectionManager, {
        connectionsRepo: mockConnectionsRepo,
        tabsRepo: mockTabsRepo,
      })

      await expect(handler.handle({ connectionId: '404' })).rejects.toThrow(/Connection 404 not found/)
    })
  })
})
