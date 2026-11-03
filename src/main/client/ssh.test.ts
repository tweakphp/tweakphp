import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SSHClient } from './ssh'

// Mock the SSH utility as a class constructor
vi.mock('../utils/ssh', () => {
  return {
    SSH: class {
      connect = vi.fn()
      disconnect = vi.fn()
      exec = vi.fn()
      execStream = vi.fn()
      uploadFile = vi.fn()
      interrupt = vi.fn()
    },
  }
})

const mockSettings = vi.hoisted(() => ({
  queryLog: false,
  outputMode: 'output',
}))

vi.mock('../settings', () => ({
  getSettings: () => mockSettings,
}))

describe('SSHClient', () => {
  let mockSSHInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSettings.queryLog = false
    mockSettings.outputMode = 'output'
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
  })

  it('connect calls ssh.connect()', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.connect.mockResolvedValue(undefined)
    await expect(client.connect()).resolves.toBeUndefined()
    expect(mockSSHInstance.connect).toHaveBeenCalled()
  })

  it('disconnect calls ssh.disconnect()', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    await client.disconnect()
    expect(mockSSHInstance.disconnect).toHaveBeenCalled()
  })

  it('remoteExec forwards calls to ssh.exec()', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockResolvedValue('output\n')
    const res = await client.remoteExec('echo hello')
    expect(res).toBe('output\n')
    expect(mockSSHInstance.exec).toHaveBeenCalledWith('echo hello')
  })

  it('executes code with the query log flag', async () => {
    const client = new SSHClient({
      type: 'ssh',
      path: '/var/www/laravel',
      host: 'localhost',
      php: '8.3',
      client_path: '/home/user/.tweakphp/client-8.3.phar',
    } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockResolvedValue('output\n')

    await client.execute('echo 1;')

    expect(mockSSHInstance.exec).toHaveBeenCalledWith(expect.stringMatching(/execute [^ ]+ --query-log=false$/))
  })

  it('enables the query log only when enabled and the output is stacked', async () => {
    const client = new SSHClient({
      type: 'ssh',
      path: '/var/www/laravel',
      host: 'localhost',
      php: '8.3',
      client_path: '/home/user/.tweakphp/client-8.3.phar',
    } as any)
    const ssh = (client as any).ssh
    ssh.exec.mockResolvedValue('output\n')
    mockSettings.queryLog = true
    mockSettings.outputMode = 'stacked'

    await client.execute('echo 1;')
    expect(ssh.exec).toHaveBeenCalledWith(expect.stringMatching(/execute [^ ]+ --query-log=true$/))

    mockSettings.outputMode = 'output'
    await client.execute('echo 1;')
    expect(ssh.exec).toHaveBeenCalledWith(expect.stringMatching(/execute [^ ]+ --query-log=false$/))
  })

  it('remoteUploadFile calls ssh.uploadFile()', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    await client.remoteUploadFile('/local/path', '/remote/path')
    expect(mockSSHInstance.uploadFile).toHaveBeenCalledWith('/local/path', '/remote/path')
  })

  it('getHomePath calls ssh.exec to echo $HOME', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockResolvedValue('/home/user\n')
    const home = await client.getHomePath()
    expect(home).toBe('/home/user')
    expect(mockSSHInstance.exec).toHaveBeenCalledWith('echo $HOME')
  })

  it('preSetupChecks throws error if path is not found on remote', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockResolvedValueOnce('not_found\n')

    await expect((client as any).preSetupChecks()).rejects.toThrow('Path not found')
  })

  it('preSetupChecks throws error if PHP is not found on remote', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec
      .mockResolvedValueOnce('found\n') // path check
      .mockResolvedValueOnce('\n') // which php check is empty

    await expect((client as any).preSetupChecks()).rejects.toThrow('PHP not found on remote server')
  })

  it('preSetupChecks resolves if both path and PHP exist', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec
      .mockResolvedValueOnce('found\n') // path check
      .mockResolvedValueOnce('/usr/bin/php\n') // which php check

    await expect((client as any).preSetupChecks()).resolves.toBeUndefined()
  })

  it('stop verifies the client then kills the remote PHP process by pid', async () => {
    const client = new SSHClient({
      type: 'ssh',
      path: '/var/www/laravel',
      host: 'localhost',
      client_path: '/home/u/.tweakphp/client-8.3.phar',
    } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockResolvedValue('')

    await client.stop(4321)

    const script = mockSSHInstance.exec.mock.calls[0][0] as string
    expect(script).toContain("grep -q -- 'client-8.3.phar' /proc/4321/cmdline")
    expect(script).toContain('kill -TERM 4321')
    expect(mockSSHInstance.exec).toHaveBeenCalledWith(script, 5_000)
    expect(mockSSHInstance.interrupt).not.toHaveBeenCalled()
  })

  it('stop escalates with SIGKILL when requested', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockResolvedValue('')

    await client.stop(4321, 'KILL')

    const script = mockSSHInstance.exec.mock.calls[0][0] as string
    expect(script).toContain('kill -KILL 4321')
  })

  it('isRunning mirrors the ssh active stream', () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh

    mockSSHInstance.hasActiveStream = vi.fn(() => false)
    expect(client.isRunning()).toBe(false)

    mockSSHInstance.hasActiveStream = vi.fn(() => true)
    expect(client.isRunning()).toBe(true)
  })

  it('stop interrupts the active stream when no pid is known', async () => {
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh

    await client.stop()

    expect(mockSSHInstance.interrupt).toHaveBeenCalledOnce()
  })

  it('stop interrupts the stream as a fallback when the remote kill fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = new SSHClient({ type: 'ssh', path: '/var/www/laravel', host: 'localhost' } as any)
    mockSSHInstance = (client as any).ssh
    mockSSHInstance.exec.mockRejectedValue(new Error('channel closed'))

    await client.stop(4321)

    expect(mockSSHInstance.interrupt).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
