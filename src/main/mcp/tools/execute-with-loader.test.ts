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

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

import { ExecuteWithLoaderHandler } from './execute-with-loader'
import * as fs from 'fs'

describe('ExecuteWithLoaderHandler Unit Tests', () => {
  let handler: ExecuteWithLoaderHandler
  let mockConnectionManager: any
  let mockHistoryDB: any
  let mockClient: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }

    mockConnectionManager = {
      getConnection: vi.fn().mockReturnValue({ id: 'local-1', type: 'local', php: 'php', path: '/laravel-app' }),
      getClient: vi.fn().mockReturnValue(mockClient),
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
    }

    mockHistoryDB = {
      insert: vi.fn().mockReturnValue(1),
    }

    handler = new ExecuteWithLoaderHandler(mockConnectionManager, mockHistoryDB)
  })

  it('throws error if code or loader parameters are invalid', async () => {
    await expect(handler.handle({ code: '', loader: 'laravel', connectionId: 'local-1' })).rejects.toThrow(
      /Parameter "code" is required/
    )
    await expect(
      handler.handle({ code: '<?php echo 1;', loader: 'invalid' as any, connectionId: 'local-1' })
    ).rejects.toThrow(/Parameter "loader" must be either/)
  })

  it('throws INVALID_PARAMETERS when neither connectionId nor projectId is provided', async () => {
    await expect(handler.handle({ code: '<?php echo 1;', loader: 'laravel' })).rejects.toThrow(
      /Specify a connectionId or a projectId/
    )
  })

  it('executes code with laravel loader when framework files exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockClient.execute.mockResolvedValue('TWEAKPHP_RESULT: {"users": 10}')

    const result = await handler.handle({
      code: '<?php echo User::count();',
      loader: 'laravel',
      projectPath: '/laravel-app',
      connectionId: 'local-1',
    })

    expect(result.output).toEqual({ users: 10 })
    expect(result.loader).toBe('laravel')
    expect(mockClient.execute).toHaveBeenCalledWith('<?php echo User::count();', undefined, '/laravel-app')
  })

  it('throws error if framework validation fails for local connection', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    await expect(
      handler.handle({
        code: '<?php echo 1;',
        loader: 'laravel',
        projectPath: '/non-existent-app',
        connectionId: 'local-1',
      })
    ).rejects.toThrow(/Failed to initialize laravel framework/)
  })

  it('bypasses local fs validation for remote connections (docker/ssh/kubectl)', async () => {
    mockConnectionManager.getConnection.mockReturnValue({
      id: 'docker-1',
      type: 'docker',
      path: '/var/www/html',
    })
    mockClient.execute.mockResolvedValue('TWEAKPHP_RESULT: "Remote Execution Output"')

    const result = await handler.handle({
      code: '<?php echo "Remote";',
      loader: 'symfony',
      connectionId: 'docker-1',
    })

    expect(result.output).toBe('Remote Execution Output')
    expect(result.connectionType).toBe('docker')
  })
})
