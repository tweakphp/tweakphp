import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execFile, spawn } from 'child_process'
import { app } from 'electron'
import { EventEmitter } from 'events'
import DockerClient from './docker'

vi.mock('../utils/ssh', () => ({
  SSH: class {
    connect = vi.fn()
    disconnect = vi.fn()
    exec = vi.fn()
    execStream = vi.fn()
    uploadFile = vi.fn()
  },
}))

vi.mock('../settings', () => ({
  getSettings: () => ({ dockerKubectlExecutionTimeoutSeconds: 60 }),
}))

vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
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

const createChildProcess = () => {
  const child = new EventEmitter() as any
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()
  return child
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

  it('sets up a Docker connection with separate CLI arguments and configured user', async () => {
    mockExecFile(args => {
      if (args.some(arg => arg.includes('PHP_MAJOR_VERSION'))) return '8.3\n'
      if (args.includes('which')) return '/usr/local/bin/php\n'
      return ''
    })

    const client = new DockerClient({ type: 'docker', container_name: 'my-container', user: 'sail' } as any)
    await client.setup()

    expect(client.connection.php_version).toBe('8.3')
    expect(client.connection.php_path).toBe('/usr/local/bin/php')
    expect(client.connection.client_path).toBe('/tmp/client-8.3.phar')
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      'docker',
      [
        'exec',
        '-u',
        'sail',
        'my-container',
        'php',
        '-r',
        "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;",
      ],
      expect.objectContaining({ shell: false, timeout: 30_000 }),
      expect.any(Function)
    )
    expect(execFile).toHaveBeenNthCalledWith(
      2,
      'docker',
      ['exec', '-u', 'sail', 'my-container', 'which', 'php'],
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
      user: 'sail',
    } as any)

    await expect(client.execute('echo "test";')).resolves.toBe('output\n')
    expect(execFile).toHaveBeenCalledWith(
      'docker',
      [
        'exec',
        '-u',
        'sail',
        'my-container',
        '/usr/bin/php',
        '/tmp/client.phar',
        '/var/www',
        'execute',
        expect.any(String),
      ],
      expect.objectContaining({ shell: false, timeout: 60_000 }),
      expect.any(Function)
    )
  })

  it('gets PHP info as the configured Docker user', async () => {
    mockExecFile(() => 'PHP 8.3\n')
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client.phar',
      working_directory: '/var/www',
      user: 'sail',
    } as any)

    await expect(client.info()).resolves.toBe('PHP 8.3\n')
    expect(execFile).toHaveBeenCalledWith(
      'docker',
      ['exec', '-u', 'sail', 'my-container', '/usr/bin/php', '/tmp/client.phar', '/var/www', 'info'],
      expect.objectContaining({ shell: false, timeout: 60_000 }),
      expect.any(Function)
    )
  })

  it('streams parsed events from a local Docker container', async () => {
    const child = createChildProcess()
    vi.mocked(spawn).mockReturnValue(child)
    const events: any[] = []
    const client = new DockerClient({
      type: 'docker',
      container_name: 'my-container',
      php_path: '/usr/bin/php',
      client_path: '/tmp/client.phar',
      working_directory: '/var/www',
      user: 'sail',
    } as any)

    const streaming = client.executeStreaming('echo "test";', undefined, event => events.push(event))
    await vi.waitFor(() => expect(spawn).toHaveBeenCalledOnce())
    child.stdout.emit('data', Buffer.from('TWEAKPHP_STR'))
    child.stdout.emit('data', Buffer.from('EAM:{"type":"output","index":0,"data":"test"}\n'))
    child.emit('close', 0, null)

    await streaming

    expect(spawn).toHaveBeenCalledWith(
      'docker',
      [
        'exec',
        '-u',
        'sail',
        'my-container',
        '/usr/bin/php',
        '/tmp/client.phar',
        '/var/www',
        'execute-stream',
        expect.any(String),
      ],
      { shell: false, windowsHide: true }
    )
    expect(events).toEqual([{ type: 'output', index: 0, data: 'test' }])
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
    expect(sshInstance.exec).toHaveBeenLastCalledWith(expect.stringContaining("'docker' 'exec' 'my-container'"), 60_000)
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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
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
    expect(consoleError).toHaveBeenCalledWith(
      'Docker command failed',
      expect.objectContaining({ message: 'Command failed: docker exec my-container.' })
    )
  })

  it('rejects unsupported PHP versions during setup', async () => {
    mockExecFile(args => (args.some(arg => arg.includes('PHP_MAJOR_VERSION')) ? '7.2\n' : ''))
    const client = new DockerClient({ type: 'docker', container_name: 'my-container' } as any)

    await expect(client.setup()).rejects.toThrow('PHP version must be 7.4 or higher')
  })
})
