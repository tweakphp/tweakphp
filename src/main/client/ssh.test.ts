import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SSHClient } from './ssh'

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

describe('SSHClient', () => {
  let mockSSHInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
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
})
