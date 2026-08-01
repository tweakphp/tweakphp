import { describe, it, expect, vi, beforeEach } from 'vitest'
import KubectlClient from './kubectl'

vi.mock('../utils/kubectl', () => {
  return {
    Kubectl: class {
      exec = vi.fn()
      execStream = vi.fn()
      uploadFile = vi.fn()
      getContexts = vi.fn()
      getNamespaces = vi.fn()
      getPods = vi.fn()
    },
  }
})

vi.mock('../settings', () => ({
  getSettings: () => ({ dockerKubectlExecutionTimeoutSeconds: 60 }),
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}))

describe('KubectlClient', () => {
  let mockKubectlInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    const client = new KubectlClient({ type: 'kubectl', path: '/app', namespace: 'default', pod: 'my-pod' } as any)
    mockKubectlInstance = (client as any).kubectl
  })

  it('remoteExec forwards calls to kubectl.exec', async () => {
    const conn = { type: 'kubectl', path: '/app', namespace: 'default', pod: 'my-pod' } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.exec.mockResolvedValue('output\n')

    const result = await client.remoteExec('echo hello')
    expect(result).toBe('output\n')
    expect(mockKubectlInstance.exec).toHaveBeenCalledWith('echo hello', conn)
  })

  it('uses execute-stream and emits structured events', async () => {
    const conn = {
      type: 'kubectl',
      path: '/app',
      namespace: 'default',
      pod: 'my-pod',
      php: '8.3',
      client_path: '/root/.tweakphp/client-8.3.phar',
    } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.execStream.mockImplementation(async (_command: string, _connection: any, onData: any) => {
      onData('TWEAKPHP_STR')
      onData('EAM:{"type":"statement.started","index":0,"line":1,"code":"echo 1;"}\n')
    })
    const events: any[] = []

    await client.executeStreaming('echo 1;', undefined, event => events.push(event))

    expect(mockKubectlInstance.execStream).toHaveBeenCalledWith(
      expect.stringContaining('execute-stream'),
      conn,
      expect.any(Function),
      60_000
    )
    expect(events).toEqual([{ type: 'statement.started', index: 0, line: 1, code: 'echo 1;' }])
  })

  it('remoteUploadFile calls kubectl.uploadFile', async () => {
    const conn = { type: 'kubectl', path: '/app', namespace: 'default', pod: 'my-pod' } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl

    await client.remoteUploadFile('/local/path', '/remote/path')
    expect(mockKubectlInstance.uploadFile).toHaveBeenCalledWith('/local/path', '/remote/path', conn)
  })

  it('getHomePath executes a POSIX command without host-shell quoting', async () => {
    const conn = { type: 'kubectl', path: '/app', namespace: 'default', pod: 'my-pod' } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.exec.mockResolvedValue('/root\n')

    const home = await client.getHomePath()
    expect(home).toBe('/root')
    expect(mockKubectlInstance.exec).toHaveBeenCalledWith('printf %s "$HOME"', conn)
  })

  it('falls back to /tmp when the Kubernetes home directory is not writable', async () => {
    const conn = { type: 'kubectl', path: '/app', namespace: 'default', pod: 'my-pod' } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.exec
      .mockResolvedValueOnce('8.3\n')
      .mockResolvedValueOnce('/readonly\n')
      .mockResolvedValueOnce('not_found\n')
      .mockRejectedValueOnce(new Error('Read-only file system'))
      .mockResolvedValueOnce('not_found\n')
      .mockResolvedValueOnce('')

    await client.setup()

    expect(client.connection.client_path).toBe('/tmp/.tweakphp/client-8.3.phar')
    expect(mockKubectlInstance.uploadFile).toHaveBeenCalledWith(
      expect.any(String),
      '/tmp/.tweakphp/client-8.3.phar',
      conn
    )
  })

  it('getContextsAction retrieves contexts from Kubectl utility', async () => {
    const client = new KubectlClient({ type: 'kubectl' } as any)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.getContexts.mockResolvedValue(['context-1', 'context-2'])

    const result = await (client as any).action('getContexts')
    expect(result).toEqual(['context-1', 'context-2'])
    expect(mockKubectlInstance.getContexts).toHaveBeenCalled()
  })

  it('getNamespacesAction retrieves namespaces from Kubectl utility', async () => {
    const conn = { type: 'kubectl', context: 'my-context' } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.getNamespaces.mockResolvedValue(['ns-1', 'ns-2'])

    const result = await (client as any).action('getNamespaces')
    expect(result).toEqual(['ns-1', 'ns-2'])
    expect(mockKubectlInstance.getNamespaces).toHaveBeenCalledWith(conn)
  })

  it('getPodsAction retrieves pods from Kubectl utility', async () => {
    const conn = { type: 'kubectl', context: 'my-context', namespace: 'ns-1' } as any
    const client = new KubectlClient(conn)
    mockKubectlInstance = (client as any).kubectl
    mockKubectlInstance.getPods.mockResolvedValue(['pod-1', 'pod-2'])

    const result = await (client as any).action('getPods')
    expect(result).toEqual(['pod-1', 'pod-2'])
    expect(mockKubectlInstance.getPods).toHaveBeenCalledWith(conn)
  })
})
