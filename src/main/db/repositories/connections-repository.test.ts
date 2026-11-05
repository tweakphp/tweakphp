import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.14.0',
    getPath: () => '/tmp',
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

import { ConnectionsRepository } from './connections-repository'

describe('ConnectionsRepository vapor ownership', () => {
  const repo = new ConnectionsRepository()

  it('defaults tab_id to the numeric id for vapor rows (per-project design)', () => {
    const saved = repo.saveConnection({
      type: 'vapor',
      id: 42,
      environment: 'production',
      environments: ['production'],
    })

    expect(saved.tab_id).toBe(42)
  })

  it('keeps an explicit tab_id when provided', () => {
    const saved = repo.saveConnection({ type: 'vapor', id: 42, tab_id: 99 })

    expect(saved.tab_id).toBe(99)
  })

  it('leaves non-numeric vapor ids unassigned (global MCP rows)', () => {
    const saved = repo.saveConnection({ type: 'vapor', id: 'vapor-production-1698000000000' })

    expect(saved.tab_id).toBeNull()
  })
})
