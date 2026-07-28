import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectPhpPaths, getSettings, setSettings, init, settingsPath } from './settings'
import { execSync } from 'child_process'
import * as fs from 'node:fs'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  lstatSync: vi.fn(),
}))

vi.mock('os', () => ({
  default: {
    homedir: () => '/mocked/home',
  },
  homedir: () => '/mocked/home',
}))

vi.mock('./system/platform', () => ({
  isWindows: vi.fn(),
}))

vi.mock('./lsp/index', () => ({
  init: vi.fn(),
}))

const ipcHandlers: Record<string, Function> = {}
const mockIpcOn = vi.fn().mockImplementation((event: string, callback: Function) => {
  ipcHandlers[event] = callback
})

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.1',
  },
  ipcMain: {
    on: (event: string, cb: Function) => mockIpcOn(event, cb),
  },
}))

import { isWindows } from './system/platform'

describe('Settings Management (settings.ts)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await init()
  })

  describe('getSettings & setSettings', () => {
    it('returns default settings when settings.json does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const settings = getSettings()
      expect(settings.version).toBe('0.13.1')
      expect(settings.theme).toBe('dracula')
      expect(settings.laravelPath).toBe('/mocked/home/.tweakphp_dev/laravel')
      expect(settings.streaming).toBe(true)
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('returns merged settings when settings.json exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(JSON.stringify({ php: 'C:\\custom\\php.exe', theme: 'monokai', editorFontSize: 18 }))
      )

      const settings = getSettings()
      expect(settings.php).toBe('C:\\custom\\php.exe')
      expect(settings.theme).toBe('monokai')
      expect(settings.editorFontSize).toBe(18)
      expect(settings.editorWordWrap).toBe('on')
      expect(settings.streaming).toBe(true)
    })

    it('preserves a disabled streaming setting', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(JSON.stringify({ streaming: false })))

      const settings = getSettings()

      expect(settings.streaming).toBe(false)
    })

    it('ignores stored laravelPath and re-persists settings when stored version or laravelPath differ', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(JSON.stringify({ version: '0.0.1', laravelPath: '/old/custom/laravel', theme: 'monokai' }))
      )

      const settings = getSettings()
      expect(settings.version).toBe('0.13.1')
      expect(settings.laravelPath).toBe('/mocked/home/.tweakphp_dev/laravel')
      expect(fs.writeFileSync).toHaveBeenCalledWith(settingsPath, JSON.stringify(settings))
    })

    it('does not re-persist settings when stored version and laravelPath already match defaults', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(
          JSON.stringify({
            version: '0.13.1',
            laravelPath: '/mocked/home/.tweakphp_dev/laravel',
            theme: 'monokai',
          })
        )
      )

      const settings = getSettings()
      expect(settings.theme).toBe('monokai')
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('writes settings to disk via setSettings', () => {
      const data: any = { theme: 'github' }
      setSettings(data)
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), JSON.stringify(data))
    })
  })

  describe('settings.store IPC handler', () => {
    it('saves settings and resolves folder path to executable path if directory is passed', async () => {
      const mockEvent = {
        sender: {
          send: vi.fn(),
        },
      }
      const payload: any = {
        php: 'C:\\php-folder',
        theme: 'monokai',
      }

      vi.mocked(isWindows).mockReturnValue(true)
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        const normalized = p.toString().replace(/\\/g, '/')
        return normalized === 'C:/php-folder' || normalized === 'C:/php-folder/php.exe'
      })
      vi.mocked(fs.lstatSync).mockReturnValue({
        isDirectory: () => true,
      } as any)

      await ipcHandlers['settings.store'](mockEvent, payload)

      expect(fs.writeFileSync).toHaveBeenCalled()
      const savedData = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string)
      expect(savedData.php.replace(/\\/g, '/')).toBe('C:/php-folder/php.exe')
      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        'settings.php-located',
        expect.stringMatching(/C:[/\\]php-folder[/\\]php\.exe/)
      )
    })
  })

  describe('PHP Executable Path Auto-Detection', () => {
    describe('Windows platform detection', () => {
      beforeEach(() => {
        vi.mocked(isWindows).mockReturnValue(true)
      })

      it('finds PHP in system PATH using where command', () => {
        vi.mocked(execSync).mockImplementation((cmd: any) => {
          if (cmd === 'where php') {
            return 'C:\\php\\php.exe\nC:\\custom-path\\php.exe\n'
          }
          if (cmd === 'wsl -l -q') {
            throw new Error('No WSL')
          }
          return ''
        })

        vi.mocked(fs.existsSync).mockImplementation((p: any) => {
          return p === 'C:\\php\\php.exe' || p === 'C:\\custom-path\\php.exe'
        })

        const paths = detectPhpPaths()
        expect(paths).toContain('C:\\php\\php.exe')
        expect(paths).toContain('C:\\custom-path\\php.exe')
      })

      it('scans common Windows folders and Laragon installations', () => {
        vi.mocked(execSync).mockImplementation((cmd: any) => {
          if (cmd === 'where php') throw new Error('not found')
          if (cmd === 'wsl -l -q') throw new Error('no wsl')
          return ''
        })

        vi.mocked(fs.existsSync).mockImplementation((p: any) => {
          const normalized = p.toString().replace(/\\/g, '/')
          const expectedPaths = [
            'C:/xampp/php/php.exe',
            '/mocked/home/AppData/Local/Herd/bin/php.exe',
            'C:/laragon/bin/php',
            'C:/laragon/bin/php/php-8.1/php.exe',
          ]
          return expectedPaths.includes(normalized)
        })

        vi.mocked(fs.readdirSync).mockImplementation((p: any) => {
          const normalized = p.toString().replace(/\\/g, '/')
          if (normalized === 'C:/laragon/bin/php') {
            return ['php-8.1'] as any
          }
          return []
        })

        const paths = detectPhpPaths()
        const normalizedPaths = paths.map(p => p.replace(/\\/g, '/'))
        expect(normalizedPaths).toContain('C:/xampp/php/php.exe')
        expect(normalizedPaths).toContain('/mocked/home/AppData/Local/Herd/bin/php.exe')
        expect(normalizedPaths).toContain('C:/laragon/bin/php/php-8.1/php.exe')
      })

      it('queries and translates WSL distro paths to Windows UNC paths', () => {
        vi.mocked(execSync).mockImplementation((cmd: any) => {
          if (cmd === 'where php') throw new Error('not found')
          if (cmd.startsWith('wsl -l -q')) {
            return Buffer.from('U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000\n\u0000', 'utf8')
          }
          if (cmd.includes('which php')) {
            return '/usr/bin/php\n'
          }
          return ''
        })

        vi.mocked(fs.existsSync).mockReturnValue(false)

        const paths = detectPhpPaths()
        expect(paths).toContain('\\\\wsl.localhost\\Ubuntu\\usr\\bin\\php')
      })
    })

    describe('Non-Windows platform detection (Linux/macOS)', () => {
      beforeEach(() => {
        vi.mocked(isWindows).mockReturnValue(false)
      })

      it('finds PHP in system PATH using which command', () => {
        vi.mocked(execSync).mockImplementation((cmd: any) => {
          if (cmd === 'which -a php') {
            return '/usr/local/bin/php\n'
          }
          return ''
        })

        vi.mocked(fs.existsSync).mockImplementation((p: any) => {
          return p === '/usr/local/bin/php'
        })

        const paths = detectPhpPaths()
        expect(paths).toContain('/usr/local/bin/php')
      })

      it('scans common Linux and macOS homebrew paths', () => {
        vi.mocked(execSync).mockImplementation(() => {
          throw new Error('not found')
        })

        vi.mocked(fs.existsSync).mockImplementation((p: any) => {
          return p === '/usr/bin/php' || p === '/opt/homebrew/bin/php'
        })

        const paths = detectPhpPaths()
        expect(paths).toContain('/usr/bin/php')
        expect(paths).toContain('/opt/homebrew/bin/php')
      })
    })
  })
})
