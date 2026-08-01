import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CodeHistoryRepository } from './code-history-repository'

const mockGet = vi.fn()
const mockRun = vi.fn()
const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
  get: (...args: any[]) => mockGet(sql, ...args),
  run: (...args: any[]) => mockRun(sql, ...args),
}))
const mockTransaction = vi.fn().mockImplementation((fn: Function) => fn)

vi.mock('../db_manager', () => ({
  db: {
    prepare: (sql: string) => mockPrepare(sql),
    transaction: (fn: Function) => mockTransaction(fn),
  },
}))

describe('CodeHistoryRepository', () => {
  let repository: CodeHistoryRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new CodeHistoryRepository()
  })

  it('updates the cursor when the code is unchanged', () => {
    mockGet.mockImplementation((sql: string) => {
      if (sql.includes('SELECT current_history_id')) return { current_history_id: 42 }
      if (sql.includes('SELECT code FROM')) return { code: 'same code' }
      return null
    })

    repository.add(1, 'same code', { lineNumber: 5, column: 10 })

    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE code_histories SET cursor_line = ?'),
      5,
      10,
      42
    )
  })

  it('branches history when the code changes', () => {
    mockGet.mockImplementation((sql: string) => {
      if (sql.includes('SELECT current_history_id')) return { current_history_id: 42 }
      if (sql.includes('SELECT code FROM')) return { code: 'old code' }
      return null
    })
    mockRun.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO code_histories')) return { lastInsertRowid: 100 }
      return {}
    })

    repository.add(1, 'new code', { lineNumber: 2, column: 3 })

    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM code_histories'), 1, 42)
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO code_histories'),
      1,
      'new code',
      2,
      3,
      expect.any(String)
    )
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO tab_states'), 1, 100)
  })

  it('returns and selects the previous state on undo', () => {
    mockGet.mockImplementation((sql: string) => {
      if (sql.includes('SELECT current_history_id')) return { current_history_id: 10 }
      if (sql.includes('ORDER BY id DESC LIMIT 1')) {
        return { id: 9, code: 'undo-code', cursor_line: 4, cursor_column: 2 }
      }
      return null
    })

    expect(repository.undo(1)).toEqual({ code: 'undo-code', cursor: { lineNumber: 4, column: 2 } })
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE tab_states'), 9, 1)
  })

  it('returns and selects the next state on redo', () => {
    mockGet.mockImplementation((sql: string) => {
      if (sql.includes('SELECT current_history_id')) return { current_history_id: 10 }
      if (sql.includes('ORDER BY id ASC LIMIT 1')) {
        return { id: 11, code: 'redo-code', cursor_line: 10, cursor_column: 5 }
      }
      return null
    })

    expect(repository.redo(1)).toEqual({ code: 'redo-code', cursor: { lineNumber: 10, column: 5 } })
    expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE tab_states'), 11, 1)
  })

  it('returns null when there is no state to undo or redo', () => {
    mockGet.mockReturnValue(null)

    expect(repository.undo(1)).toBeNull()
    expect(repository.redo(1)).toBeNull()
  })
})
