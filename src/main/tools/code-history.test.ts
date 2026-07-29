import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initCodeHistory } from './code-history'

const mockGet = vi.fn()
const mockRun = vi.fn()
const mockDbPrepare = vi.fn().mockImplementation((sql: string) => ({
  get: (...args: any[]) => mockGet(sql, ...args),
  run: (...args: any[]) => mockRun(sql, ...args),
}))
const mockDbTransaction = vi.fn().mockImplementation((fn: Function) => fn)

vi.mock('../db/db_manager', () => ({
  db: {
    transaction: (fn: any) => mockDbTransaction(fn),
    prepare: (sql: string) => mockDbPrepare(sql),
  },
}))

const ipcHandlers: Record<string, Function> = {}
const mockIpcOn = vi.fn().mockImplementation((event: string, callback: Function) => {
  ipcHandlers[event] = callback
})

vi.mock('electron', () => ({
  ipcMain: {
    on: (event: string, cb: Function) => mockIpcOn(event, cb),
  },
}))

describe('Code History Manager', () => {
  let consoleErrorSpy: any

  beforeEach(async () => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await initCodeHistory()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('registers all history IPC handlers', () => {
    expect(mockIpcOn).toHaveBeenCalledWith('code-add', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('code-undo', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('code-redo', expect.any(Function))
  })

  describe('code-add handler', () => {
    it('replies with error if zod validation fails', async () => {
      const mockEvent = { reply: vi.fn() }
      await ipcHandlers['code-add'](mockEvent, { tabId: -1, code: '', cursor: { lineNumber: 1, column: 1 } })

      expect(mockEvent.reply).toHaveBeenCalledWith('code-add.reply', {
        data: null,
        error: 'Failed to add code history',
      })
    })

    it('updates cursor positions if code has not changed', async () => {
      const mockEvent = { reply: vi.fn() }

      mockGet.mockImplementation((sql: string) => {
        if (sql.includes('SELECT current_history_id')) return { current_history_id: 42 }
        if (sql.includes('SELECT code FROM')) return { code: 'my identical code' }
        return null
      })

      await ipcHandlers['code-add'](mockEvent, {
        tabId: 1,
        code: 'my identical code',
        cursor: { lineNumber: 5, column: 10 },
      })

      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE code_histories SET cursor_line = ?'),
        5,
        10,
        42
      )
      expect(mockEvent.reply).toHaveBeenCalledWith('code-add.reply', { data: { success: true }, error: null })
    })

    it('branches history and inserts new code record if code has changed', async () => {
      const mockEvent = { reply: vi.fn() }

      mockGet.mockImplementation((sql: string) => {
        if (sql.includes('SELECT current_history_id')) return { current_history_id: 42 }
        if (sql.includes('SELECT code FROM')) return { code: 'old code' }
        return null
      })

      mockRun.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO code_histories')) {
          return { lastInsertRowid: 100 }
        }
        return {}
      })

      await ipcHandlers['code-add'](mockEvent, {
        tabId: 1,
        code: 'new code!',
        cursor: { lineNumber: 2, column: 3 },
      })

      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM code_histories'), 1, 42)
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO code_histories'),
        1,
        'new code!',
        2,
        3,
        expect.any(String)
      )
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO tab_states'), 1, 100)
      expect(mockEvent.reply).toHaveBeenCalledWith('code-add.reply', { data: { success: true }, error: null })
    })
  })

  describe('code-undo handler', () => {
    it('replies with previous code state if it exists', async () => {
      const mockEvent = { reply: vi.fn() }

      mockGet.mockImplementation((sql: string) => {
        if (sql.includes('SELECT current_history_id')) return { current_history_id: 10 }
        if (sql.includes('ORDER BY id DESC LIMIT 1')) {
          return { id: 9, code: 'undo-code', cursor_line: 4, cursor_column: 2 }
        }
        return null
      })

      await ipcHandlers['code-undo'](mockEvent, 1)

      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE tab_states'), 9, 1)
      expect(mockEvent.reply).toHaveBeenCalledWith('code-undo.reply', {
        data: {
          code: 'undo-code',
          cursor: { lineNumber: 4, column: 2 },
        },
        error: null,
      })
    })

    it('replies with error if no previous state exists', async () => {
      const mockEvent = { reply: vi.fn() }

      mockGet.mockImplementation((sql: string) => {
        if (sql.includes('SELECT current_history_id')) return { current_history_id: 10 }
        return null
      })

      await ipcHandlers['code-undo'](mockEvent, 1)

      expect(mockEvent.reply).toHaveBeenCalledWith('code-undo.reply', {
        data: null,
        error: 'No previous state to undo.',
      })
    })
  })

  describe('code-redo handler', () => {
    it('replies with next code state if it exists', async () => {
      const mockEvent = { reply: vi.fn() }

      mockGet.mockImplementation((sql: string) => {
        if (sql.includes('SELECT current_history_id')) return { current_history_id: 10 }
        if (sql.includes('ORDER BY id ASC LIMIT 1')) {
          return { id: 11, code: 'redo-code', cursor_line: 10, cursor_column: 5 }
        }
        return null
      })

      await ipcHandlers['code-redo'](mockEvent, 1)

      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('UPDATE tab_states'), 11, 1)
      expect(mockEvent.reply).toHaveBeenCalledWith('code-redo.reply', {
        data: {
          code: 'redo-code',
          cursor: { lineNumber: 10, column: 5 },
        },
        error: null,
      })
    })

    it('replies with error if no next state exists', async () => {
      const mockEvent = { reply: vi.fn() }

      mockGet.mockImplementation((sql: string) => {
        if (sql.includes('SELECT current_history_id')) return { current_history_id: 10 }
        return null
      })

      await ipcHandlers['code-redo'](mockEvent, 1)

      expect(mockEvent.reply).toHaveBeenCalledWith('code-redo.reply', {
        data: null,
        error: 'No next state to redo.',
      })
    })
  })
})
