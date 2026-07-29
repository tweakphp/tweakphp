import { describe, it, expect, vi, beforeEach } from 'vitest'
import DockerClient from './docker'
import { exec, execSync } from 'child_process'

// Mock the SSH utility as a class constructor
vi.mock('../utils/ssh', () => {
  return {
    SSH: class {
      connect = vi.fn()
      disconnect = vi.fn()
      exec = vi.fn()
      uploadFile = vi.fn()
    },
  }
})

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.1.0',
  },
}))

describe('DockerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default execSync mock return value to prevent crash on 'which docker'
    vi.mocked(execSync).mockReturnValue('docker\n')
  })

  it('connect calls ssh.connect if ssh is defined', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      ssh: { host: 'my-host' },
    } as any)

    const sshInstance = (client as any).ssh
    sshInstance.connect.mockResolvedValue(undefined)

    await client.connect()
    expect(sshInstance.connect).toHaveBeenCalled()
  })

  it('setup retrieves PHP info and client path', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
    } as any)

    // Dynamic mock for execSync to return correct value based on command
    vi.mocked(execSync).mockImplementation((command: any) => {
      const cmdStr = command.toString()
      if (cmdStr.includes('which docker')) {
        return 'docker\n'
      }
      if (cmdStr.includes('PHP_MAJOR_VERSION')) {
        return '8.1\n'
      }
      if (cmdStr.includes('which php')) {
        return '/usr/local/bin/php\n'
      }
      if (cmdStr.includes('cp')) {
        return ''
      }
      return ''
    })

    await client.setup()

    expect(client.connection.php_version).toBe('8.1')
    expect(client.connection.php_path).toBe('/usr/local/bin/php')
    expect(client.connection.client_path).toBe('/tmp/client-8.1.phar')
  })

  it('setup is a silent no-op if container_name is missing', async () => {
    const client = new DockerClient({
      type: 'docker',
    } as any)

    await expect(client.setup()).resolves.toBeUndefined()
  })

  it('setup throws error if php version < 7.4', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
    } as any)

    vi.mocked(execSync).mockImplementation((command: any) => {
      const cmdStr = command.toString()
      if (cmdStr.includes('which docker')) {
        return 'docker\n'
      }
      if (cmdStr.includes('PHP_MAJOR_VERSION')) {
        return '7.2\n'
      }
      return ''
    })

    await expect(client.setup()).rejects.toThrow('PHP version must be 7.4 or higher')
  })

  it('execute runs code in local docker container', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client-8.1.phar',
      working_directory: '/var/www',
    } as any)

    vi.mocked(exec).mockImplementation((_cmd, cb) => {
      // @ts-ignore
      cb(null, 'output\n')
      return {} as any
    })

    const result = await client.execute('echo "test";')
    expect(result).toBe('output\n')
    expect(exec).toHaveBeenCalled()
    const command = vi.mocked(exec).mock.calls[0][0] as string
    expect(command).toContain('docker exec my-container "/usr/bin/php" "/tmp/client-8.1.phar" "/var/www" execute')
  })

  it('execute runs code in docker container via SSH', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client-8.1.phar',
      working_directory: '/var/www',
      ssh: { host: 'my-host-unique' },
    } as any)

    const sshInstance = (client as any).ssh
    sshInstance.exec.mockImplementation((command: string) => {
      if (command.includes('which docker')) {
        return 'docker\n'
      }
      return 'ssh output\n'
    })

    const result = await client.execute('echo "test";')
    expect(result).toBe('ssh output\n')
    expect(sshInstance.exec).toHaveBeenCalled()
    const command = sshInstance.exec.mock.lastCall[0] as string
    expect(command).toContain('docker exec my-container')
  })

  it('info retrieves info via SSH', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client-8.1.phar',
      working_directory: '/var/www',
      ssh: { host: 'my-host-unique-info' },
    } as any)

    const sshInstance = (client as any).ssh
    sshInstance.exec.mockImplementation((command: string) => {
      if (command.includes('which docker')) {
        return 'docker\n'
      }
      return 'ssh info output\n'
    })

    const result = await client.info()
    expect(result).toBe('ssh info output\n')
    expect(sshInstance.exec).toHaveBeenCalled()
    const command = sshInstance.exec.mock.lastCall[0] as string
    expect(command).toContain('docker exec my-container')
    expect(command).toContain('info')
  })

  it('getContainersAction returns list of docker containers', async () => {
    const client = new DockerClient({ type: 'docker' } as any)

    vi.mocked(execSync).mockImplementation((command: any) => {
      const cmdStr = command.toString()
      if (cmdStr.includes('which docker')) {
        return 'docker\n'
      }
      if (cmdStr.includes('ps --format')) {
        return '123|my-container|php-image\n456|other-container|mysql-image\n'
      }
      return ''
    })

    const containers = await (client as any).action('getContainers')
    expect(containers).toEqual([
      { id: '123', name: 'my-container', image: 'php-image' },
      { id: '456', name: 'other-container', image: 'mysql-image' },
    ])
  })

  it('getContainersAction throws parsed error on failure', async () => {
    const client = new DockerClient({ type: 'docker' } as any)
    vi.mocked(execSync).mockImplementation((command: any) => {
      const cmdStr = command.toString()
      if (cmdStr.includes('which docker')) {
        return 'docker\n'
      }
      throw new Error("docker daemon is not running. See 'docker daemon --help' for details")
    })

    await expect((client as any).action('getContainers')).rejects.toThrow('docker daemon is not running.')
  })

  it('getPHPVersionAction action retrieves version', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
    } as any)

    vi.mocked(execSync).mockImplementation((command: any) => {
      const cmdStr = command.toString()
      if (cmdStr.includes('which docker')) return 'docker\n'
      if (cmdStr.includes('PHP_MAJOR_VERSION')) return '8.2\n'
      return ''
    })

    const result = await (client as any).action('getPHPVersion')
    expect(result).toBe('8.2')
  })

  it('getDockerPath falls back to "docker" when command fails', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client-8.1.phar',
      working_directory: '/var/www',
    } as any)

    vi.mocked(execSync).mockImplementation((command: any) => {
      const cmdStr = command.toString()
      if (cmdStr.includes('which docker')) {
        throw new Error('Command which failed')
      }
      return ''
    })

    vi.mocked(exec).mockImplementation((_cmd, cb) => {
      // @ts-ignore
      cb(null, 'output')
      return {} as any
    })

    await client.execute('echo 1;')
    const command = vi.mocked(exec).mock.calls[0][0] as string
    expect(command.startsWith('docker exec')).toBe(true)
  })
})
