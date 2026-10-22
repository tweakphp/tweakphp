import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkspaceFoldersRepository } from './workspace-folders-repository'

const mockGet = vi.fn()
const mockRun = vi.fn()
const mockAll = vi.fn()
const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
  get: (...args: any[]) => mockGet(sql, ...args),
  run: (...args: any[]) => mockRun(sql, ...args),
  all: (...args: any[]) => mockAll(sql, ...args),
}))
const mockTransaction = vi.fn().mockImplementation((fn: Function) => fn)

vi.mock('../db_manager', () => ({
  db: {
    prepare: (sql: string) => mockPrepare(sql),
    transaction: (fn: Function) => mockTransaction(fn),
  },
}))

describe('WorkspaceFoldersRepository', () => {
  let repository: WorkspaceFoldersRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new WorkspaceFoldersRepository()
  })

  it('lists folders ordered by position', () => {
    mockAll.mockReturnValue([
      { id: 2, name: 'Second', position: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 1, name: 'First', position: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ])

    const folders = repository.getAllFolders()

    expect(folders).toEqual([
      { id: 2, name: 'Second', position: 1, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 1, name: 'First', position: 0, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ])
    expect(mockAll).toHaveBeenCalledWith(expect.stringContaining('ORDER BY position ASC, id ASC'))
  })

  it('creates a folder with the next position', () => {
    mockGet.mockReturnValue({ maxPosition: 3 })
    mockRun.mockReturnValue({ lastInsertRowid: 10 })

    const folder = repository.createFolder('New folder')

    expect(folder).toMatchObject({ id: 10, name: 'New folder', position: 4 })
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO workspace_folders'),
      'New folder',
      4,
      expect.any(String),
      expect.any(String)
    )
  })

  it('creates the first folder with position 0', () => {
    mockGet.mockReturnValue({ maxPosition: -1 })
    mockRun.mockReturnValue({ lastInsertRowid: 1 })

    expect(repository.createFolder('First')).toMatchObject({ position: 0 })
  })

  it('updates folder name and position', () => {
    mockRun.mockReturnValue({ changes: 1 })

    const result = repository.updateFolder({
      id: 2,
      name: 'Renamed',
      position: 5,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    })

    expect(result).toBe(true)
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE workspace_folders'),
      'Renamed',
      5,
      expect.any(String),
      2
    )
  })

  it('returns false when updating a missing folder', () => {
    mockRun.mockReturnValue({ changes: 0 })

    expect(repository.updateFolder({ id: 99, name: 'Nope', position: 0, created_at: '', updated_at: '' })).toBe(false)
  })

  it('detaches tabs before deleting the folder', () => {
    mockRun.mockImplementation((sql: string) => {
      if (sql.includes('DELETE FROM workspace_folders')) {
        return { changes: 1 }
      }
      return { changes: 0 }
    })

    expect(repository.deleteFolder(7)).toBe(true)

    const detachCall = mockRun.mock.calls.find(([sql]) => sql.includes('UPDATE tabs SET folder_id = NULL'))
    const deleteCall = mockRun.mock.calls.find(([sql]) => sql.includes('DELETE FROM workspace_folders'))
    expect(detachCall).toEqual([expect.stringContaining('UPDATE tabs SET folder_id = NULL'), 7])
    expect(deleteCall).toEqual([expect.stringContaining('DELETE FROM workspace_folders'), 7])
    expect(mockRun.mock.invocationCallOrder).toBeDefined()
    const detachIndex = mockRun.mock.calls.findIndex(([sql]) => sql.includes('UPDATE tabs SET folder_id = NULL'))
    const deleteIndex = mockRun.mock.calls.findIndex(([sql]) => sql.includes('DELETE FROM workspace_folders'))
    expect(detachIndex).toBeLessThan(deleteIndex)
  })

  it('reorders folders by the given id list', () => {
    repository.reorderFolders([5, 3, 9])

    expect(mockRun).toHaveBeenCalledTimes(3)
    expect(mockRun).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE workspace_folders'),
      0,
      expect.any(String),
      5
    )
    expect(mockRun).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE workspace_folders'),
      1,
      expect.any(String),
      3
    )
    expect(mockRun).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('UPDATE workspace_folders'),
      2,
      expect.any(String),
      9
    )
  })
})
