import { describe, expect, it } from 'vitest'
import { buildIntelephenseInitializationOptions, intelephenseStoragePath, isWslWorkspacePath } from './language-server'

describe('isWslWorkspacePath', () => {
  it.each([
    ['\\\\wsl$\\Ubuntu\\home\\user\\app', true],
    ['\\\\wsl.localhost\\Ubuntu-22.04\\home\\user\\app', true],
    ['\\\\WSL$\\Ubuntu\\app', true],
    ['//wsl$/Ubuntu/home/user/app', true],
    ['//wsl.localhost/Ubuntu/app', true],
    ['C:\\Users\\user\\app', false],
    ['C:\\projects\\wsl\\app', false],
    ['/home/user/app', false],
    ['wsl$/foo', false],
    ['\\\\otherserver\\share\\app', false],
    ['', false],
    [undefined, false],
  ])('detects WSL UNC paths (%s)', (input, expected) => {
    expect(isWslWorkspacePath(input)).toBe(expected)
  })
})

describe('intelephenseStoragePath', () => {
  it('builds the storage path under the given per-user temp dir', () => {
    const tempDir = 'C:\\Users\\dev\\AppData\\Local\\Temp'
    const workspacePath = 'C:\\projects\\app'

    expect(intelephenseStoragePath(tempDir, workspacePath)).toBe(
      `${tempDir}/tweakphp-intelephense-${encodeURIComponent(workspacePath)}`
    )
  })

  it('keeps workspaces isolated from each other', () => {
    const tempDir = '/Users/dev/Library/Caches/TemporaryItems'

    expect(intelephenseStoragePath(tempDir, '/work/app-a')).not.toBe(intelephenseStoragePath(tempDir, '/work/app-b'))
  })

  it('strips trailing separators from the temp dir', () => {
    expect(intelephenseStoragePath('/tmp/', '/x')).toBe('/tmp/tweakphp-intelephense-%2Fx')
    expect(intelephenseStoragePath('C:\\Temp\\', '/x')).toBe('C:\\Temp/tweakphp-intelephense-%2Fx')
  })
})

describe('buildIntelephenseInitializationOptions', () => {
  const baseOptions = { workspacePath: '/work/app', tempDir: '/tmp' }

  it('points storagePath at the per-user temp dir and scopes the environment to the workspace', () => {
    const options = buildIntelephenseInitializationOptions({ ...baseOptions, licenseKey: 'key-123' })

    expect(options.storagePath).toBe('/tmp/tweakphp-intelephense-%2Fwork%2Fapp')
    expect(options.environment).toBe('/work/app')
    expect(options.clearCache).toBe(true)
    expect(options.licenceKey).toBe('key-123')
  })

  it('omits the licence key when none is configured (free version)', () => {
    const options = buildIntelephenseInitializationOptions(baseOptions)

    expect(options.licenceKey).toBeUndefined()
  })

  it('excludes VCS and vendored folders from indexing', () => {
    const options = buildIntelephenseInitializationOptions(baseOptions)

    expect(options.files.maxSize).toBe(100_000_000)
    expect(options.files.exclude).toContain('**/node_modules/**')
    expect(options.files.exclude).toContain('**/.git/**')
  })
})
