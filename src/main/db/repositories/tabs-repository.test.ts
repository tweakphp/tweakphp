import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TabsRepository } from './tabs-repository'

const mockGet = vi.fn()
const runCalls: { sql: string; args: any[] }[] = []
const mockRun = vi.fn().mockImplementation(() => ({ changes: 1 }))
const mockPrepare = vi.fn().mockImplementation((sql: string) => ({
  get: (...args: any[]) => mockGet(sql, ...args),
  run: (...args: any[]) => {
    runCalls.push({ sql, args })
    return mockRun(sql, ...args)
  },
}))
const mockTransaction = vi.fn().mockImplementation((fn: Function) => fn)

vi.mock('../db_manager', () => ({
  db: {
    prepare: (sql: string) => mockPrepare(sql),
    transaction: (fn: Function) => mockTransaction(fn),
  },
}))

describe('TabsRepository.deleteTab', () => {
  let repository: TabsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    runCalls.length = 0
    repository = new TabsRepository()
  })

  it('force delete purges history, state, connections and the tab (children first)', () => {
    const deleted = repository.deleteTab(1729, true)

    expect(deleted).toBe(true)
    expect(runCalls.map(call => call.sql)).toEqual([
      expect.stringContaining('DELETE FROM code_histories WHERE tab_id'),
      expect.stringContaining('DELETE FROM tab_states WHERE tab_id'),
      expect.stringContaining('DELETE FROM connections WHERE tab_id'),
      expect.stringContaining('DELETE FROM tabs WHERE id'),
    ])
    // same bound id everywhere: stringified, affinity handles the conversion
    expect(runCalls.map(call => call.args)).toEqual([['1729'], ['1729'], ['1729'], ['1729']])
  })

  it('soft delete only marks the row trashed and never touches child rows', () => {
    const deleted = repository.deleteTab(1729, false)

    expect(deleted).toBe(true)
    expect(runCalls).toHaveLength(1)
    expect(runCalls[0].sql).toContain('UPDATE tabs SET deleted_at')
  })
})
