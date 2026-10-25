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
  ListFoldersHandler,
  CreateFolderHandler,
  UpdateFolderHandler,
  DeleteFolderHandler,
  ReorderFoldersHandler,
} from './folders'
import type { WorkspaceFoldersRepository } from '../../db/repositories/workspace-folders-repository'

describe('Folder MCP handlers', () => {
  let mockFoldersRepo: WorkspaceFoldersRepository
  let folders: { id: number; name: string; position: number }[]

  beforeEach(() => {
    folders = [
      { id: 1, name: 'Work', position: 0 },
      { id: 2, name: 'Personal', position: 1 },
    ]

    mockFoldersRepo = {
      getAllFolders: vi.fn().mockImplementation(() => folders.map(f => ({ ...f, created_at: '', updated_at: '' }))),
      createFolder: vi.fn().mockImplementation((name: string) => ({
        id: 3,
        name,
        position: 2,
        created_at: '',
        updated_at: '',
      })),
      updateFolder: vi.fn().mockReturnValue(true),
      deleteFolder: vi.fn().mockReturnValue(true),
      reorderFolders: vi.fn(),
    } as unknown as WorkspaceFoldersRepository
  })

  it('lists folders', async () => {
    const handler = new ListFoldersHandler({ foldersRepo: mockFoldersRepo })
    const result = await handler.handle()

    expect(result.folders).toHaveLength(2)
    expect(result.folders[0]).toMatchObject({ id: 1, name: 'Work' })
  })

  it('creates a folder', async () => {
    const handler = new CreateFolderHandler({ foldersRepo: mockFoldersRepo })
    const folder = await handler.handle({ name: 'Client projects' })

    expect(folder).toMatchObject({ id: 3, name: 'Client projects' })
    expect(mockFoldersRepo.createFolder).toHaveBeenCalledWith('Client projects')
  })

  it('rejects invalid folder names on create', async () => {
    const handler = new CreateFolderHandler({ foldersRepo: mockFoldersRepo })

    await expect(handler.handle({ name: '' })).rejects.toThrow(/between 1 and 100/)
    await expect(handler.handle({ name: 'x'.repeat(101) })).rejects.toThrow(/between 1 and 100/)
  })

  it('renames a folder', async () => {
    const handler = new UpdateFolderHandler({ foldersRepo: mockFoldersRepo })

    const result = await handler.handle({ folderId: 1, name: 'Work 2026' })

    expect(result.success).toBe(true)
    expect(mockFoldersRepo.updateFolder).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Work 2026' }))
  })

  it('rejects renaming an unknown folder', async () => {
    const handler = new UpdateFolderHandler({ foldersRepo: mockFoldersRepo })

    await expect(handler.handle({ folderId: 99, name: 'x' })).rejects.toThrow(/Folder 99 not found/)
  })

  it('deletes a folder', async () => {
    const handler = new DeleteFolderHandler({ foldersRepo: mockFoldersRepo })

    const result = await handler.handle({ folderId: 2 })

    expect(result.success).toBe(true)
    expect(mockFoldersRepo.deleteFolder).toHaveBeenCalledWith(2)
  })

  it('reorders folders with the full ordered id list', async () => {
    const handler = new ReorderFoldersHandler({ foldersRepo: mockFoldersRepo })

    const result = await handler.handle({ folderIds: [2, 1] })

    expect(result.success).toBe(true)
    expect(mockFoldersRepo.reorderFolders).toHaveBeenCalledWith([2, 1])
  })

  it('rejects reordering with unknown ids', async () => {
    const handler = new ReorderFoldersHandler({ foldersRepo: mockFoldersRepo })

    await expect(handler.handle({ folderIds: [1, 99] })).rejects.toThrow(/Unknown folder ids: 99/)
  })
})
