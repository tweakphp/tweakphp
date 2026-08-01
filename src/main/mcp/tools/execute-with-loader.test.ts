import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
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
      getActiveConnection: vi.fn().mockReturnValue({ id: 'local-1', type: 'local', php: 'php', path: '/laravel-app' }),
      getConnection: vi.fn(),
      getClient: vi.fn().mockReturnValue(mockClient),
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
    }

    mockHistoryDB = {
      insert: vi.fn().mockReturnValue(1),
    }

    handler = new ExecuteWithLoaderHandler(mockConnectionManager, mockHistoryDB)
  })

  it('throws error if code or loader parameters are invalid', async () => {
    await expect(handler.handle({ code: '', loader: 'laravel' })).rejects.toThrow(/Parameter "code" is required/)
    await expect(handler.handle({ code: '<?php echo 1;', loader: 'invalid' as any })).rejects.toThrow(
      /Parameter "loader" must be either/
    )
  })

  it('executes code with laravel loader when framework files exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    mockClient.execute.mockResolvedValue('TWEAKPHP_RESULT: {"users": 10}')

    const result = await handler.handle({
      code: '<?php echo User::count();',
      loader: 'laravel',
      projectPath: '/laravel-app',
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
      })
    ).rejects.toThrow(/Failed to initialize laravel framework/)
  })

  it('bypasses local fs validation for remote connections (docker/ssh/kubectl)', async () => {
    mockConnectionManager.getActiveConnection.mockReturnValue({
      id: 'docker-1',
      type: 'docker',
      path: '/var/www/html',
    })
    mockClient.execute.mockResolvedValue('TWEAKPHP_RESULT: "Remote Execution Output"')

    const result = await handler.handle({
      code: '<?php echo "Remote";',
      loader: 'symfony',
    })

    expect(result.output).toBe('Remote Execution Output')
    expect(result.connectionType).toBe('docker')
  })
})
