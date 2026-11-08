import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
}))

// db_manager loads better-sqlite3 at import time: mock it so unit tests
// never load the native module (compiled for Electron, not for Node)
vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {
    prepare = vi.fn().mockReturnValue({ get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() })
    transaction = vi.fn().mockImplementation((fn: any) => fn)
    pragma = vi.fn()
  },
}))

vi.mock('./project-connection', () => ({
  resolveProjectConnection: vi.fn().mockReturnValue({
    tab: { id: 1, name: 'app', path: '/app', execution: 'local' },
    connection: { id: 'local-1', type: 'local', php: 'php' },
  }),
}))

import { GetPhpInfoHandler } from './get-php-info'

describe('GetPhpInfoHandler Unit Tests', () => {
  let handler: GetPhpInfoHandler
  let mockConnectionManager: any
  let mockClient: any

  const samplePhpInfo = `
phpinfo()
PHP Version => 8.3.1
System => Darwin Kat-MBP 23.0.0
Loaded Configuration File => /etc/php.ini

[PHP Modules]
bcmath
curl
date
json
mbstring

Environment
PATH => /usr/bin:/bin
FOO => bar
`

  beforeEach(() => {
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue(samplePhpInfo),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }

    mockConnectionManager = {
      getClient: vi.fn().mockReturnValue(mockClient),
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
    }

    handler = new GetPhpInfoHandler(mockConnectionManager)
  })

  it('throws INVALID_PARAMETERS when projectId is not provided', async () => {
    await expect(handler.handle({})).rejects.toThrow(/Specify a projectId/)
  })

  it('returns parsed PHP info with all sections when section is all', async () => {
    const result = await handler.handle({ projectId: 1, section: 'all' })

    expect(result.phpVersion).toBe('8.3.1')
    expect(result.sections.general.version).toBe('8.3.1')
    expect(result.sections.general.configurationFile).toBe('/etc/php.ini')
    expect(result.sections.modules.loaded).toContain('curl')
    expect(result.sections.modules.loaded).toContain('json')
    expect(result.sections.environment.FOO).toBe('bar')
    expect(result.raw).toBe(samplePhpInfo)
    expect(mockClient.disconnect).toHaveBeenCalled()
  })

  it('filters sections when a specific section is requested', async () => {
    const result = await handler.handle({ projectId: 1, section: 'general' })

    expect(result.phpVersion).toBe('8.3.1')
    expect(result.sections.general).toBeDefined()
    expect(result.sections.modules).toBeUndefined()
    expect(result.raw).toBeUndefined()
  })

  it('throws CONNECTION_ERROR if section name is unknown', async () => {
    await expect(handler.handle({ projectId: 1, section: 'invalid' as any })).rejects.toThrow(
      /Failed to retrieve PHP info/
    )
  })

  it('parses JSON output returned by phar client info command', async () => {
    mockClient.info.mockResolvedValue(JSON.stringify({ name: 'Laravel', version: '11.0.0', php_version: '8.5.0' }))
    const result = await handler.handle({ projectId: 1, section: 'all' })

    expect(result.phpVersion).toBe('8.5.0')
    expect(result.sections.general.frameworkName).toBe('Laravel')
    expect(result.sections.general.frameworkVersion).toBe('11.0.0')
    expect(result.sections.general.version).toBe('8.5.0')
  })
})
