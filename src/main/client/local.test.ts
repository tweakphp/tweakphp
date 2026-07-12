import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  LocalClient,
  getWslDetails,
  translateWindowsToWslPath,
  getWslPhpExecutable,
  getPHPVersion,
  getLocalPharClient,
} from './local'
import { exec, execSync } from 'child_process'
import { app } from 'electron'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}))

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.1.0',
  },
}))

// Mock settings
vi.mock('../settings', () => ({
  getSettings: () => ({
    php: 'C:\\php\\php.exe',
  }),
}))

describe('LocalClient WSL Support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(execSync).mockReturnValue('8.1\n')
  })

  describe('getWslDetails', () => {
    it('detects standard wsl.localhost path', () => {
      const details = getWslDetails('\\\\wsl.localhost\\Ubuntu\\home\\david')
      expect(details.isWsl).toBe(true)
      expect(details.distro).toBe('Ubuntu')
    })

    it('detects wsl$ UNC path', () => {
      const details = getWslDetails('\\\\wsl$\\Debian\\home\\david')
      expect(details.isWsl).toBe(true)
      expect(details.distro).toBe('Debian')
    })

    it('returns false for standard Windows paths', () => {
      const details = getWslDetails('C:\\Users\\David\\project')
      expect(details.isWsl).toBe(false)
      expect(details.distro).toBeNull()
    })

    it('returns false for Linux/macOS absolute paths', () => {
      const details = getWslDetails('/home/david/project')
      expect(details.isWsl).toBe(false)
      expect(details.distro).toBeNull()
    })

    it('handles forward slashes in UNC path', () => {
      const details = getWslDetails('//wsl.localhost/Ubuntu/home/david')
      expect(details.isWsl).toBe(true)
      expect(details.distro).toBe('Ubuntu')
    })
  })

  describe('translateWindowsToWslPath', () => {
    it('translates wsl.localhost UNC paths correctly', () => {
      const translated = translateWindowsToWslPath('\\\\wsl.localhost\\Ubuntu\\home\\david\\project', 'Ubuntu')
      expect(translated).toBe('/home/david/project')
    })

    it('translates wsl$ UNC paths correctly', () => {
      const translated = translateWindowsToWslPath('\\\\wsl$\\Ubuntu\\home\\david\\project', 'Ubuntu')
      expect(translated).toBe('/home/david/project')
    })

    it('translates Windows drive paths correctly', () => {
      const translated = translateWindowsToWslPath('C:\\Users\\David\\project', 'Ubuntu')
      expect(translated).toBe('/mnt/c/Users/David/project')
    })

    it('leaves standard Linux/macOS paths unchanged', () => {
      const translated = translateWindowsToWslPath('/home/david/project', 'Ubuntu')
      expect(translated).toBe('/home/david/project')
    })
  })

  describe('getWslPhpExecutable', () => {
    it('defaults to php if empty/undefined', () => {
      expect(getWslPhpExecutable(undefined)).toBe('php')
    })

    it('defaults to php if Windows path is provided', () => {
      expect(getWslPhpExecutable('C:\\php\\php.exe')).toBe('php')
      expect(getWslPhpExecutable('php.exe')).toBe('php')
    })

    it('keeps Linux paths', () => {
      expect(getWslPhpExecutable('/usr/bin/php')).toBe('/usr/bin/php')
      expect(getWslPhpExecutable('php8.2')).toBe('php8.2')
    })

    it('translates and adapts WSL UNC paths to the target project distro', () => {
      const path = getWslPhpExecutable('\\\\wsl.localhost\\Ubuntu\\usr\\bin\\php', 'Debian')
      expect(path).toBe('/usr/bin/php')
    })
  })

  describe('getPHPVersion', () => {
    it('returns the PHP version for non-WSL PHP', () => {
      vi.mocked(execSync).mockReturnValue('8.2.0\n')
      const version = getPHPVersion({ type: 'local', php: 'C:\\php\\php.exe', path: 'C:\\project' })
      expect(version).toBe('8.2.0')
      expect(execSync).toHaveBeenCalledWith(
        '"C:\\php\\php.exe" -r "echo PHP_MAJOR_VERSION . \'.\' . PHP_MINOR_VERSION . PHP_EOL;"',
        expect.any(Object)
      )
    })

    it('returns the PHP version for WSL PHP', () => {
      vi.mocked(execSync).mockReturnValue('8.3.0\n')
      const version = getPHPVersion({ type: 'local', php: 'php', path: '\\\\wsl.localhost\\Ubuntu\\project' })
      expect(version).toBe('8.3.0')
      expect(execSync).toHaveBeenCalledWith(
        'wsl -d "Ubuntu" php -r "echo PHP_MAJOR_VERSION . \'.\' . PHP_MINOR_VERSION . PHP_EOL;"',
        expect.any(Object)
      )
    })

    it('returns null on execution error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed')
      })
      const version = getPHPVersion({ type: 'local', php: 'php', path: 'C:\\project' })
      expect(version).toBeNull()
      consoleSpy.mockRestore()
    })
  })

  describe('getLocalPharClient', () => {
    beforeEach(() => {
      delete process.env.CLIENT_PATH
      app.isPackaged = false
    })

    it('uses CLIENT_PATH env variable if set', () => {
      process.env.CLIENT_PATH = '/custom/phar/client.phar'
      const clientPath = getLocalPharClient()
      expect(clientPath).toBe('/custom/phar/client.phar')
    })

    it('uses process.resourcesPath when app is packaged', () => {
      app.isPackaged = true
      process.resourcesPath = '/packaged/resources'
      const clientPath = getLocalPharClient()
      expect(clientPath).toContain('/packaged/resources')
      app.isPackaged = false
    })
  })

  describe('LocalClient Class', () => {
    it('executes a standard Windows path command', async () => {
      const client = new LocalClient({
        type: 'local',
        path: 'C:\\Users\\David\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'TWEAKPHP_RESULT:{"status":"success"}')
        return {} as any
      })

      await client.execute('echo "hello";')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string

      expect(commandRun).not.toContain('wsl -d')
      expect(commandRun).toContain('C:\\php\\php.exe')
    })

    it('executes a standard Linux/macOS path command', async () => {
      const client = new LocalClient({
        type: 'local',
        path: '/home/david/project',
        php: '/usr/bin/php',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'TWEAKPHP_RESULT:{"status":"success"}')
        return {} as any
      })

      await client.execute('echo "hello";')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string

      expect(commandRun).not.toContain('wsl -d')
      expect(commandRun).toContain('"/usr/bin/php"')
      expect(commandRun).toContain('"/home/david/project"')
    })

    it('executes a WSL path command using wsl wrapper', async () => {
      const client = new LocalClient({
        type: 'local',
        path: '\\\\wsl.localhost\\Ubuntu\\home\\david\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'TWEAKPHP_RESULT:{"status":"success"}')
        return {} as any
      })

      await client.execute('echo "hello";')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string

      expect(commandRun).toContain('wsl -d "Ubuntu" php')
      expect(commandRun).not.toContain('C:\\php\\php.exe "/')
      expect(commandRun).toContain('"/home/david/project"')
    })

    it('executes a command with loader option', async () => {
      const client = new LocalClient({
        type: 'local',
        path: 'C:\\Users\\David\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'TWEAKPHP_RESULT:{"status":"success"}')
        return {} as any
      })

      await client.execute('echo "hello";', 'my-custom-loader')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string
      expect(commandRun).toContain('--loader=')
    })

    it('retrieves project info on standard Windows path', async () => {
      const client = new LocalClient({
        type: 'local',
        path: 'C:\\Users\\David\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'Laravel Framework 10.0.0')
        return {} as any
      })

      const info = await client.info()
      expect(info).toBe('Laravel Framework 10.0.0')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string
      expect(commandRun).not.toContain('wsl -d')
      expect(commandRun).toContain('info')
    })

    it('retrieves project info on standard Linux/macOS path', async () => {
      const client = new LocalClient({
        type: 'local',
        path: '/home/david/project',
        php: '/usr/bin/php',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'Laravel Framework 10.0.0')
        return {} as any
      })

      const info = await client.info()
      expect(info).toBe('Laravel Framework 10.0.0')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string
      expect(commandRun).not.toContain('wsl -d')
      expect(commandRun).toContain('"/usr/bin/php"')
      expect(commandRun).toContain('"/home/david/project"')
    })

    it('retrieves project info on WSL path', async () => {
      const client = new LocalClient({
        type: 'local',
        path: '\\\\wsl.localhost\\Ubuntu\\home\\david\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'Laravel Framework 10.0.0')
        return {} as any
      })

      const info = await client.info()
      expect(info).toBe('Laravel Framework 10.0.0')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string
      expect(commandRun).toContain('wsl -d "Ubuntu" php')
      expect(commandRun).toContain('info')
    })

    it('retrieves project info with loader option', async () => {
      const client = new LocalClient({
        type: 'local',
        path: 'C:\\Users\\David\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(null, 'Laravel Framework 10.0.0')
        return {} as any
      })

      const info = await client.info('my-custom-loader')
      expect(info).toBe('Laravel Framework 10.0.0')
      expect(exec).toHaveBeenCalled()
      const commandRun = vi.mocked(exec).mock.calls[0][0] as string
      expect(commandRun).toContain('--loader=')
    })

    it('rejects the Promise when info shell execution fails', async () => {
      const client = new LocalClient({
        type: 'local',
        path: 'C:\\Users\\David\\project',
        php: 'C:\\php\\php.exe',
      })

      vi.mocked(exec).mockImplementation((_cmd, cb) => {
        // @ts-ignore
        cb(new Error('Shell error'), null)
        return {} as any
      })

      await expect(client.info()).rejects.toBe('Shell error')
    })
  })
})
