import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execFile } from 'child_process'
import { Kubectl } from './kubectl'

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

describe('Kubectl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(execFile).mockImplementation(((_file: any, _args: any, _options: any, callback: any) => {
      callback(null, 'result\n', '')
      return {} as any
    }) as any)
  })

  it('lists contexts with kubectl directly instead of using which', async () => {
    await expect(new Kubectl().getContexts()).resolves.toEqual(['result'])
    expect(execFile).toHaveBeenCalledWith(
      'kubectl',
      ['config', 'get-contexts', '-o', 'name'],
      expect.objectContaining({ shell: false, timeout: 30_000 }),
      expect.any(Function)
    )
  })

  it('passes remote commands as one sh -lc argument', async () => {
    const kubectl = new Kubectl()
    await expect(
      kubectl.exec('printf %s "$HOME"', { pod: 'app', context: 'local', namespace: 'default' })
    ).resolves.toBe('result')

    expect(execFile).toHaveBeenCalledWith(
      'kubectl',
      ['exec', 'app', '--context=local', '--namespace=default', '--', 'sh', '-lc', 'printf %s "$HOME"'],
      expect.objectContaining({ shell: false, timeout: 60_000 }),
      expect.any(Function)
    )
  })

  it('copies a Windows PHAR from its directory so kubectl does not parse its drive as a pod', async () => {
    await expect(
      new Kubectl().uploadFile('C:\\Program Files\\TweakPHP\\client.phar', '/root/.tweakphp/client.phar', {
        pod: 'app',
        context: 'local',
        namespace: 'default',
      })
    ).resolves.toBeUndefined()

    expect(execFile).toHaveBeenCalledWith(
      'kubectl',
      ['cp', 'client.phar', 'app:/root/.tweakphp/client.phar', '--context=local', '--namespace=default'],
      expect.objectContaining({ cwd: 'C:\\Program Files\\TweakPHP', shell: false, timeout: 30_000 }),
      expect.any(Function)
    )
  })
})
