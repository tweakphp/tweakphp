import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerCodeHistoryIpc } from './code-history-ipc'

const { mockAdd, mockUndo, mockRedo } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockUndo: vi.fn(),
  mockRedo: vi.fn(),
}))

vi.mock('../db/repositories/code-history-repository', () => ({
  CodeHistoryRepository: class {
    add = mockAdd
    undo = mockUndo
    redo = mockRedo
  },
}))

const ipcHandlers: Record<string, Function> = {}
const mockIpcOn = vi.fn().mockImplementation((event: string, callback: Function) => {
  ipcHandlers[event] = callback
})

vi.mock('electron', () => ({
  ipcMain: {
    on: (event: string, callback: Function) => mockIpcOn(event, callback),
  },
}))

describe('Code History IPC', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    registerCodeHistoryIpc()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('registers all history IPC handlers', () => {
    expect(mockIpcOn).toHaveBeenCalledWith('code-add', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('code-undo', expect.any(Function))
    expect(mockIpcOn).toHaveBeenCalledWith('code-redo', expect.any(Function))
  })

  it('validates and stores a code state', () => {
    const event = { reply: vi.fn() }
    const payload = { tabId: 1, code: '<?php echo 1;', cursor: { lineNumber: 2, column: 3 } }

    ipcHandlers['code-add'](event, payload)

    expect(mockAdd).toHaveBeenCalledWith(1, '<?php echo 1;', { lineNumber: 2, column: 3 })
    expect(event.reply).toHaveBeenCalledWith('code-add.reply', { data: { success: true }, error: null })
  })

  it('replies with an error when adding an invalid state', () => {
    const event = { reply: vi.fn() }

    ipcHandlers['code-add'](event, { tabId: -1, code: '', cursor: { lineNumber: 1, column: 1 } })

    expect(mockAdd).not.toHaveBeenCalled()
    expect(event.reply).toHaveBeenCalledWith('code-add.reply', {
      data: null,
      error: 'Failed to add code history',
    })
  })

  it('replies with the previous state on undo', () => {
    const event = { reply: vi.fn() }
    const state = { code: 'undo-code', cursor: { lineNumber: 4, column: 2 } }
    mockUndo.mockReturnValue(state)

    ipcHandlers['code-undo'](event, 1)

    expect(mockUndo).toHaveBeenCalledWith(1)
    expect(event.reply).toHaveBeenCalledWith('code-undo.reply', { data: state, error: null })
  })

  it('replies with an error when undo has no previous state', () => {
    const event = { reply: vi.fn() }
    mockUndo.mockReturnValue(null)

    ipcHandlers['code-undo'](event, 1)

    expect(event.reply).toHaveBeenCalledWith('code-undo.reply', {
      data: null,
      error: 'No previous state to undo.',
    })
  })

  it('replies with the next state on redo', () => {
    const event = { reply: vi.fn() }
    const state = { code: 'redo-code', cursor: { lineNumber: 10, column: 5 } }
    mockRedo.mockReturnValue(state)

    ipcHandlers['code-redo'](event, 1)

    expect(mockRedo).toHaveBeenCalledWith(1)
    expect(event.reply).toHaveBeenCalledWith('code-redo.reply', { data: state, error: null })
  })

  it('replies with an error when redo has no next state', () => {
    const event = { reply: vi.fn() }
    mockRedo.mockReturnValue(null)

    ipcHandlers['code-redo'](event, 1)

    expect(event.reply).toHaveBeenCalledWith('code-redo.reply', {
      data: null,
      error: 'No next state to redo.',
    })
  })
})
