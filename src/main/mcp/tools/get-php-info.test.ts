import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
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
      getActiveConnection: vi.fn().mockReturnValue({ id: 'local-1', type: 'local', php: 'php' }),
      getClient: vi.fn().mockReturnValue(mockClient),
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
    }

    handler = new GetPhpInfoHandler(mockConnectionManager)
  })

  it('throws CONNECTION_ERROR if no active connection is set', async () => {
    mockConnectionManager.getActiveConnection.mockReturnValue(null)
    await expect(handler.handle({})).rejects.toThrow(/No active connection available/)
  })

  it('returns parsed PHP info with all sections when section is all', async () => {
    const result = await handler.handle({ section: 'all' })

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
    const result = await handler.handle({ section: 'general' })

    expect(result.phpVersion).toBe('8.3.1')
    expect(result.sections.general).toBeDefined()
    expect(result.sections.modules).toBeUndefined()
    expect(result.raw).toBeUndefined()
  })

  it('throws CONNECTION_ERROR if section name is unknown', async () => {
    await expect(handler.handle({ section: 'invalid' as any })).rejects.toThrow(/Failed to retrieve PHP info/)
  })

  it('parses JSON output returned by phar client info command', async () => {
    mockClient.info.mockResolvedValue(JSON.stringify({ name: 'Laravel', version: '11.0.0', php_version: '8.5.0' }))
    const result = await handler.handle({ section: 'all' })

    expect(result.phpVersion).toBe('8.5.0')
    expect(result.sections.general.frameworkName).toBe('Laravel')
    expect(result.sections.general.frameworkVersion).toBe('11.0.0')
    expect(result.sections.general.version).toBe('8.5.0')
  })
})
