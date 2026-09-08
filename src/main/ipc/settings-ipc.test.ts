import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerSettingsIpc } from './settings-ipc'
import type { IpcResult } from './ipc-utils'
import * as fs from 'node:fs'

const { mockSetSettings, mockDetectPhpPaths, mockInitLsp } = vi.hoisted(() => ({
  mockSetSettings: vi.fn(),
  mockDetectPhpPaths: vi.fn(),
  mockInitLsp: vi.fn(),
}))

vi.mock('../settings', () => ({
  setSettings: mockSetSettings,
  detectPhpPaths: mockDetectPhpPaths,
}))

vi.mock('../lsp/coordinator', () => ({
  initLsp: mockInitLsp,
}))

vi.mock('../system/platform', () => ({
  isWindows: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
}))

const ipcHandlers: Record<string, Function> = {}
const mockIpcHandle = vi.fn().mockImplementation((event: string, callback: Function) => {
  ipcHandlers[event] = callback
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: (event: string, callback: Function) => mockIpcHandle(event, callback),
  },
}))

import { isWindows } from '../system/platform'

const validPayload = {
  version: '0.13.1',
  laravelPath: '/mocked/home/.tweakphp_dev/laravel',
  php: '/usr/bin/php',
  theme: 'dracula',
  editorFontSize: 15,
  editorWordWrap: 'on',
  layout: 'vertical',
  output: 'code',
  vimMode: 'off',
  stackedDump: 'extended',
  windowWidth: 1100,
  windowHeight: 700,
  aiStatus: false,
  aiPromptTemplateGenerateCodeFromComment: '',
  aiPromptTemplateCompleteComment: '',
  aiPromptTemplateCompleteCode: '',
  navigationDisplay: 'collapsed',
  mcpEnabled: false,
  mcpPort: 3000,
  streaming: true,
  dockerKubectlExecutionTimeoutSeconds: 60,
}

const mockEvent = {
  sender: {
    send: vi.fn(),
  },
}

describe('Settings IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isWindows).mockReturnValue(false)
    registerSettingsIpc()
  })

  it('registers all settings IPC handlers', () => {
    expect(mockIpcHandle).toHaveBeenCalledWith('settings:store', expect.any(Function))
    expect(mockIpcHandle).toHaveBeenCalledWith('settings:save', expect.any(Function))
    expect(mockIpcHandle).toHaveBeenCalledWith('settings:detect-php', expect.any(Function))
  })

  it('stores settings and re-initializes the LSP on non-Windows platforms', async () => {
    const result: IpcResult<{ success: boolean }> = await ipcHandlers['settings:store'](mockEvent, { ...validPayload })

    expect(mockSetSettings).toHaveBeenCalledWith(expect.objectContaining({ php: '/usr/bin/php' }))
    expect(mockInitLsp).toHaveBeenCalled()
    expect(result).toEqual({ data: { success: true }, error: null })
  })

  it('skips the LSP re-initialization on Windows', async () => {
    vi.mocked(isWindows).mockReturnValue(true)

    await ipcHandlers['settings:store'](mockEvent, { ...validPayload })

    expect(mockInitLsp).not.toHaveBeenCalled()
  })

  it('saves settings and always re-initializes the LSP', async () => {
    vi.mocked(isWindows).mockReturnValue(true)

    const result: IpcResult<{ success: boolean }> = await ipcHandlers['settings:save'](mockEvent, { ...validPayload })

    expect(mockSetSettings).toHaveBeenCalled()
    expect(mockInitLsp).toHaveBeenCalled()
    expect(result).toEqual({ data: { success: true }, error: null })
  })

  it('resolves a php directory to the executable path and notifies the renderer', async () => {
    vi.mocked(isWindows).mockReturnValue(true)
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const normalized = p.toString().replace(/\\/g, '/')
      return normalized === 'C:/php-folder' || normalized === 'C:/php-folder/php.exe'
    })
    vi.mocked(fs.lstatSync).mockReturnValue({
      isDirectory: () => true,
    } as any)

    await ipcHandlers['settings:store'](mockEvent, { ...validPayload, php: 'C:\\php-folder' })

    const savedData = mockSetSettings.mock.calls[0][0]
    expect(savedData.php.replace(/\\/g, '/')).toBe('C:/php-folder/php.exe')
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      'settings:php-located',
      expect.stringMatching(/C:[/\\]php-folder[/\\]php\.exe/)
    )
  })

  it('replies with an error envelope when storing settings fails', async () => {
    mockSetSettings.mockImplementationOnce(() => {
      throw new Error('disk full')
    })

    const result: IpcResult<null> = await ipcHandlers['settings:store'](mockEvent, { ...validPayload })

    expect(result.data).toBeNull()
    expect(result.error).toBe('disk full')
  })

  it('replies with an error envelope when the LSP re-initialization fails', async () => {
    mockInitLsp.mockRejectedValueOnce(new Error('lsp boom'))

    const result: IpcResult<null> = await ipcHandlers['settings:store'](mockEvent, { ...validPayload })

    expect(mockSetSettings).toHaveBeenCalled()
    expect(result.data).toBeNull()
    expect(result.error).toBe('lsp boom')
  })

  it('replies with an error envelope on invalid payloads', async () => {
    const result: IpcResult<null> = await ipcHandlers['settings:store'](mockEvent, { php: 42 })

    expect(mockSetSettings).not.toHaveBeenCalled()
    expect(result.data).toBeNull()
    expect(result.error).toBe('Invalid payload')
  })

  it('returns detected php paths in the data envelope', async () => {
    mockDetectPhpPaths.mockReturnValueOnce(['/usr/bin/php', '/usr/local/bin/php'])

    const result: IpcResult<string[]> = await ipcHandlers['settings:detect-php'](mockEvent)

    expect(result).toEqual({ data: ['/usr/bin/php', '/usr/local/bin/php'], error: null })
  })

  it('replies with an error envelope when detection fails', async () => {
    mockDetectPhpPaths.mockImplementationOnce(() => {
      throw new Error('which failed')
    })

    const result: IpcResult<null> = await ipcHandlers['settings:detect-php'](mockEvent)

    expect(result.data).toBeNull()
    expect(result.error).toBe('which failed')
  })
})
