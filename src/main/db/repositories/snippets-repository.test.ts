import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SnippetsRepository } from './snippets-repository'

const mockAll = vi.fn()
const mockGet = vi.fn()
const mockRun = vi.fn()
const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
  all: (...args: any[]) => mockAll(sql, ...args),
  get: (...args: any[]) => mockGet(sql, ...args),
  run: (...args: any[]) => mockRun(sql, ...args),
}))

vi.mock('../db_manager', () => ({
  db: {
    prepare: (sql: string) => mockPrepare(sql),
  },
}))

describe('SnippetsRepository', () => {
  let repository: SnippetsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new SnippetsRepository()
  })

  it('lists all snippets ordered by updated_at desc', () => {
    mockAll.mockReturnValue([
      { id: '1', title: 'A', code: 'echo 1;', created_at: '2024-01-01', updated_at: '2024-01-02' },
    ])

    const snippets = repository.getAllSnippets()

    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY updated_at DESC'))
    expect(snippets).toEqual([
      { id: '1', title: 'A', code: 'echo 1;', created_at: '2024-01-01', updated_at: '2024-01-02' },
    ])
  })

  it('filters snippets by search term on title and code', () => {
    mockAll.mockReturnValue([])

    repository.getAllSnippets('foo')

    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE title LIKE ? OR code LIKE ?'))
    expect(mockAll).toHaveBeenCalledWith(expect.any(String), '%foo%', '%foo%')
  })

  it('saves a new snippet with a generated id and null title when blank', () => {
    mockGet.mockReturnValue(undefined)

    const saved = repository.saveSnippet({ title: '  ', code: 'echo "hi";' })

    expect(saved.id).toBeTruthy()
    expect(saved.title).toBeNull()
    expect(saved.code).toBe('echo "hi";')
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO snippets'),
      saved.id,
      null,
      'echo "hi";',
      expect.any(String),
      expect.any(String)
    )
  })

  it('keeps the original created_at when updating an existing snippet', () => {
    mockGet.mockReturnValue({ created_at: '2024-01-01T00:00:00.000Z' })

    const saved = repository.saveSnippet({ id: 'abc', title: 'My snippet', code: 'phpinfo();' })

    expect(saved.created_at).toBe('2024-01-01T00:00:00.000Z')
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(id) DO UPDATE'),
      'abc',
      'My snippet',
      'phpinfo();',
      '2024-01-01T00:00:00.000Z',
      expect.any(String)
    )
  })

  it('deletes a snippet and reports whether a row was removed', () => {
    mockRun.mockReturnValue({ changes: 1 })
    expect(repository.deleteSnippet('abc')).toBe(true)

    mockRun.mockReturnValue({ changes: 0 })
    expect(repository.deleteSnippet('missing')).toBe(false)

    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM snippets'), 'abc')
  })
})
