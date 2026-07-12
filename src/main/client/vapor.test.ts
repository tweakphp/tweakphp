import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VaporClient } from './vapor'
import { readFileSync } from 'fs'
import { exec } from 'child_process'
import { load as yamlParse } from 'js-yaml'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}))

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}))

// Mock js-yaml
vi.mock('js-yaml', () => ({
  load: vi.fn(),
}))

describe('VaporClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('execute throws error if client_path is missing', async () => {
    const client = new VaporClient({ type: 'vapor' } as any)
    await expect(client.execute('echo hello')).rejects.toThrow('Missing client path in connection configuration.')
  })

  it('execute returns alert message if loader is passed', async () => {
    const client = new VaporClient({ type: 'vapor', client_path: '/my-project' } as any)
    const result = await client.execute('echo hello', 'my-loader')
    expect(result).toBe('The loader option is not supported in connection type vapor.')
  })

  it('execute runs vapor tinker successfully and returns output', async () => {
    const client = new VaporClient({ type: 'vapor', client_path: '/my-project', environment: 'production' } as any)

    vi.mocked(exec).mockImplementation((_cmd, _opts, cb) => {
      // @ts-ignore
      cb(null, { stdout: 'tinker output\n', stderr: '' })
      return {} as any
    })

    const result = await client.execute('<?php echo "hello"; ?>')
    expect(result).toBe('tinker output\n')

    expect(exec).toHaveBeenCalled()
    const command = vi.mocked(exec).mock.calls[0][0] as string
    expect(command).toContain('vapor tinker production -n --code')

    // Decode the base64 argument in the command to verify it contains our code
    const base64Match = command.match(/base64_decode\("([^"]+)"\)/)
    expect(base64Match).not.toBeNull()
    const decodedCode = Buffer.from(base64Match![1], 'base64').toString('utf8')
    expect(decodedCode).toContain('echo "hello";')
    expect(decodedCode).not.toContain('<?php')
  })

  it('execute returns stderr if command output has stderr', async () => {
    const client = new VaporClient({ type: 'vapor', client_path: '/my-project' } as any)

    vi.mocked(exec).mockImplementation((_cmd, _opts, cb) => {
      // @ts-ignore
      cb(null, { stdout: '', stderr: 'tinker error' })
      return {} as any
    })

    const result = await client.execute('echo "hello";')
    expect(result).toBe('Error: tinker error')
  })

  it('execute returns catch message on process exception', async () => {
    const client = new VaporClient({ type: 'vapor', client_path: '/my-project' } as any)

    vi.mocked(exec).mockImplementation(() => {
      throw new Error('Spawn failed')
    })

    const result = await client.execute('echo "hello";')
    expect(result).toContain('Exception: Spawn failed')
  })

  it('getEnvironmentsAction returns list of environments from vapor.yml', () => {
    const client = new VaporClient({ type: 'vapor', client_path: '/my-project' } as any)

    vi.mocked(readFileSync).mockReturnValue('vapor yaml content')
    vi.mocked(yamlParse).mockReturnValue({
      environments: {
        staging: {},
        production: {},
      },
    })

    const envs = client.getEnvironmentsAction()
    expect(envs).toEqual(['staging', 'production'])
    expect(readFileSync).toHaveBeenCalled()
    expect(yamlParse).toHaveBeenCalledWith('vapor yaml content')
  })

  it('getEnvironmentsAction returns empty array on exception', () => {
    const client = new VaporClient({ type: 'vapor', client_path: '/my-project' } as any)

    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('File not found')
    })

    const envs = client.getEnvironmentsAction()
    expect(envs).toEqual([])
  })

  it('getEnvironmentsAction returns empty array if no client_path configured', () => {
    const client = new VaporClient({ type: 'vapor' } as any)
    const envs = client.getEnvironmentsAction()
    expect(envs).toEqual([])
  })
})
