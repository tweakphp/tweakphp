import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
}))

import { ExecutePhpHandler } from './execute-php'

describe('ExecutePhpHandler Unit Tests', () => {
  let handler: ExecutePhpHandler
  let mockConnectionManager: any
  let mockHistoryDB: any
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }

    mockConnectionManager = {
      getActiveConnection: vi.fn().mockReturnValue({ id: 'local-1', type: 'local', php: 'php', path: '/app' }),
      getConnection: vi.fn(),
      getClient: vi.fn().mockReturnValue(mockClient),
      getConnectionName: vi.fn().mockReturnValue('Local Connection'),
    }

    mockHistoryDB = {
      insert: vi.fn().mockReturnValue(1),
    }

    handler = new ExecutePhpHandler(mockConnectionManager, mockHistoryDB)
  })

  it('throws INVALID_PARAMETERS if code parameter is missing or empty', async () => {
    await expect(handler.handle({ code: '' })).rejects.toThrow(/Parameter "code" is required/)
  })

  it('throws CONNECTION_ERROR if no active connection exists', async () => {
    mockConnectionManager.getActiveConnection.mockReturnValue(null)
    await expect(handler.handle({ code: '<?php echo 1;' })).rejects.toThrow(/No active connection available/)
  })

  it('executes PHP code successfully and saves execution record to DB', async () => {
    mockClient.execute.mockResolvedValue('TWEAKPHP_RESULT: "Hello World"')

    const result = await handler.handle({ code: '<?php echo "Hello World";' })

    expect(result.output).toBe('Hello World')
    expect(result.exitCode).toBe(0)
    expect(result.connectionType).toBe('local')
    expect(mockHistoryDB.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: '<?php echo "Hello World";',
        exitCode: 0,
        connectionType: 'local',
      })
    )
    expect(mockClient.disconnect).toHaveBeenCalled()
  })

  it('handles execution timeout and records failure in history DB', async () => {
    mockClient.execute.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('done'), 200)))

    await expect(handler.handle({ code: '<?php sleep(10);', timeout: 30 })).rejects.toThrow(/exceeded timeout of 30ms/)

    expect(mockHistoryDB.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        exitCode: 1,
        error: 'TIMEOUT',
      })
    )
  })
})
