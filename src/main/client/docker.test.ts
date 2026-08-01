import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execFile } from 'child_process'
import { app } from 'electron'
import DockerClient from './docker'

vi.mock('../utils/ssh', () => ({
  SSH: class {
    connect = vi.fn()
    disconnect = vi.fn()
    exec = vi.fn()
    uploadFile = vi.fn()
  },
}))

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}))

const mockExecFile = (handler: (args: string[]) => string) => {
  vi.mocked(execFile).mockImplementation(((_file: any, args: any, _options: any, callback: any) => {
    callback(null, handler(args), '')
    return {} as any
  }) as any)
}

describe('DockerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(app as any).isPackaged = false
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: '/app/resources',
    })
  })

  it('connects through SSH when the connection has SSH settings', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      ssh: { host: 'docker-host' },
    } as any)
    const sshInstance = (client as any).ssh

    await client.connect()

    expect(sshInstance.connect).toHaveBeenCalledOnce()
  })

  it('sets up a Docker connection with separate CLI arguments', async () => {
    mockExecFile(args => {
      if (args.some(arg => arg.includes('PHP_MAJOR_VERSION'))) return '8.3\n'
      if (args.includes('which')) return '/usr/local/bin/php\n'
      return ''
    })

    const client = new DockerClient({ type: 'docker', container_name: 'my-container' } as any)
    await client.setup()

    expect(client.connection.php_version).toBe('8.3')
    expect(client.connection.php_path).toBe('/usr/local/bin/php')
    expect(client.connection.client_path).toBe('/tmp/client-8.3.phar')
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      'docker',
      ['exec', 'my-container', 'php', '-r', "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"],
      expect.objectContaining({ shell: false, timeout: 30_000 }),
      expect.any(Function)
    )
    expect(execFile).toHaveBeenLastCalledWith(
      'docker',
      ['cp', expect.stringContaining('client-8.3.phar'), 'my-container:/tmp/client-8.3.phar'],
      expect.objectContaining({ shell: false, timeout: 30_000 }),
      expect.any(Function)
    )
  })

  it('uses packaged resources for the PHAR on Windows and every other platform', async () => {
    ;(app as any).isPackaged = true
    mockExecFile(args =>
      args.some(arg => arg.includes('PHP_MAJOR_VERSION')) ? '8.2\n' : args.includes('which') ? 'php\n' : ''
    )

    const client = new DockerClient({ type: 'docker', container_name: 'my-container' } as any)
    await client.setup()

    expect(execFile).toHaveBeenLastCalledWith(
      'docker',
      ['cp', '/app/resources/public/client-8.2.phar', 'my-container:/tmp/client-8.2.phar'],
      expect.any(Object),
      expect.any(Function)
    )
    ;(app as any).isPackaged = false
  })

  it('executes user code without a shell and with a 60 second timeout', async () => {
    mockExecFile(() => 'output\n')
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client.phar',
      working_directory: '/var/www',
    } as any)

    await expect(client.execute('echo "test";')).resolves.toBe('output\n')
    expect(execFile).toHaveBeenCalledWith(
      'docker',
      ['exec', 'my-container', '/usr/bin/php', '/tmp/client.phar', '/var/www', 'execute', expect.any(String)],
      expect.objectContaining({ shell: false, timeout: 60_000 }),
      expect.any(Function)
    )
  })

  it('executes Docker commands through SSH when configured', async () => {
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client.phar',
      working_directory: '/var/www',
      ssh: { host: 'docker-host-execute' },
    } as any)
    const sshInstance = (client as any).ssh
    sshInstance.exec.mockImplementation(async (command: string) =>
      command === 'which docker' ? 'docker\n' : 'ssh output\n'
    )

    await expect(client.execute('echo "test";')).resolves.toBe('ssh output\n')
    expect(sshInstance.exec).toHaveBeenLastCalledWith(expect.stringContaining("docker 'exec' 'my-container'"))
  })

  it('lists local Docker containers', async () => {
    mockExecFile(args => (args[0] === 'ps' ? '123|my-container|php-image\n456|other-container|mysql-image\n' : ''))
    const client = new DockerClient({ type: 'docker' } as any)

    await expect((client as any).action('getContainers')).resolves.toEqual([
      { id: '123', name: 'my-container', image: 'php-image' },
      { id: '456', name: 'other-container', image: 'mysql-image' },
    ])
  })

  it('returns parsed Docker errors from failed commands', async () => {
    vi.mocked(execFile).mockImplementation(((_file: any, _args: any, _options: any, callback: any) => {
      callback(new Error("Command failed: docker exec my-container. See 'docker exec --help'"), '', '')
      return {} as any
    }) as any)

    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: 'php',
      client_path: '/tmp/client.phar',
      working_directory: '/var/www',
    } as any)

    await expect(client.info()).rejects.toThrow('Command failed: docker exec my-container.')
  })

  it('rejects unsupported PHP versions during setup', async () => {
    mockExecFile(args => (args.some(arg => arg.includes('PHP_MAJOR_VERSION')) ? '7.2\n' : ''))
    const client = new DockerClient({ type: 'docker', container_name: 'my-container' } as any)

    await expect(client.setup()).rejects.toThrow('PHP version must be 7.4 or higher')
  })
})
