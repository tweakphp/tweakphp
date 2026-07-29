import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RemoteClient } from './client.remote'
import { app } from 'electron'

// Mock electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.1.0',
  },
}))

class TestRemoteClient extends RemoteClient {
  public mockExec = vi.fn()
  public uploadedFiles: { localPath: string; remotePath: string }[] = []
  public mockHomePath = '/home/mock_user'

  constructor(connection: any) {
    super(connection)
  }

  async remoteExec(command: string): Promise<string> {
    return this.mockExec(command)
  }

  async remoteUploadFile(localPath: string, remotePath: string): Promise<void> {
    this.uploadedFiles.push({ localPath, remotePath })
  }

  async getHomePath(): Promise<string> {
    return this.mockHomePath
  }
}

describe('RemoteClient Shared Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('setup throws error if remote PHP version is < 7.4', async () => {
    const client = new TestRemoteClient({ path: '/remote/project' })
    client.mockExec.mockResolvedValueOnce('7.2\n')

    await expect(client.setup()).rejects.toThrow('PHP version must be 7.4 or higher')
  })

  it('setup uploads phar if not found on remote', async () => {
    const client = new TestRemoteClient({ path: '/remote/project' })
    client.mockExec
      .mockResolvedValueOnce('8.2.0\n') // PHP version check
      .mockResolvedValueOnce('not_found\n') // Phar check
      .mockResolvedValueOnce('') // mkdir command

    await client.setup()

    expect(client.uploadedFiles).toHaveLength(1)
    expect(client.uploadedFiles[0].remotePath).toBe('/home/mock_user/.tweakphp/client-8.2.0.phar')
    expect(client.connection.client_path).toBe('/home/mock_user/.tweakphp/client-8.2.0.phar')
    expect(client.connection.php).toBe('8.2.0')
  })

  it('setup does not upload phar if already present on remote', async () => {
    const client = new TestRemoteClient({ path: '/remote/project' })
    client.mockExec
      .mockResolvedValueOnce('8.2.0\n') // PHP version check
      .mockResolvedValueOnce('found\n') // Phar check

    await client.setup()

    expect(client.uploadedFiles).toHaveLength(0)
    expect(client.connection.client_path).toBe('/home/mock_user/.tweakphp/client-8.2.0.phar')
  })

  it('execute runs remote command with base64 encoded code', async () => {
    const client = new TestRemoteClient({
      path: '/remote/project',
      php: '8.2.0',
      client_path: '/home/mock_user/.tweakphp/client-8.2.0.phar',
    })

    client.mockExec.mockResolvedValue('output')

    const result = await client.execute('echo "test";')
    expect(result).toBe('output')
    expect(client.mockExec).toHaveBeenCalled()
    const commandSent = client.mockExec.mock.calls[0][0]
    expect(commandSent).toContain('php /home/mock_user/.tweakphp/client-8.2.0.phar /remote/project execute')
  })

  it('info runs remote command to retrieve project info', async () => {
    const client = new TestRemoteClient({
      path: '/remote/project',
      php: '8.2.0',
      client_path: '/home/mock_user/.tweakphp/client-8.2.0.phar',
    })

    client.mockExec.mockResolvedValue('project_info')

    const result = await client.info()
    expect(result).toBe('project_info')
    expect(client.mockExec).toHaveBeenCalled()
    const commandSent = client.mockExec.mock.calls[0][0]
    expect(commandSent).toContain('php /home/mock_user/.tweakphp/client-8.2.0.phar /remote/project info')
  })
})
