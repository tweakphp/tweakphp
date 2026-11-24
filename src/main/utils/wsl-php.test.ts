import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execSync } from 'child_process'
import { clearWslPhpCache, detectWslPhpPathsInDistro, resolveWslPhpBinary } from './wsl-php'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

describe('wsl-php helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearWslPhpCache()
  })

  it('finds user-space WSL PHP shims like Lerd even when which php fails', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      if (cmd.includes('which php')) {
        throw new Error('php not found')
      }
      if (cmd.includes('--exec sh -c') && cmd.includes('lerd/bin/php')) {
        return '/home/david/.local/share/lerd/bin/php\n'
      }
      return ''
    })

    expect(detectWslPhpPathsInDistro('Ubuntu')).toEqual(['/home/david/.local/share/lerd/bin/php'])
    expect(resolveWslPhpBinary('Ubuntu')).toBe('/home/david/.local/share/lerd/bin/php')
  })

  it('falls back to interactive shell lookup when common paths are absent', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      if (cmd.includes('which php')) {
        throw new Error('php not found')
      }
      if (cmd.includes('lerd/bin/php')) {
        return ''
      }
      if (cmd.includes('-ic')) {
        return '/custom/bin/php\n'
      }
      return ''
    })

    expect(detectWslPhpPathsInDistro('Ubuntu')).toEqual(['/custom/bin/php'])
  })

  it('caches resolved binary per distro and defaults to php when nothing is found', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      if (cmd.includes('lerd/bin/php')) {
        return '/home/david/.local/share/lerd/bin/php\n'
      }
      throw new Error('not found')
    })

    expect(resolveWslPhpBinary('Ubuntu')).toBe('/home/david/.local/share/lerd/bin/php')
    const callsAfterFirst = vi.mocked(execSync).mock.calls.length
    expect(resolveWslPhpBinary('Ubuntu')).toBe('/home/david/.local/share/lerd/bin/php')
    expect(vi.mocked(execSync).mock.calls.length).toBe(callsAfterFirst)

    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found')
    })
    expect(resolveWslPhpBinary('Debian')).toBe('php')
  })
})
