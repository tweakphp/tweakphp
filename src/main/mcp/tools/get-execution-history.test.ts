import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
}))

import { GetExecutionHistoryHandler } from './get-execution-history'

describe('GetExecutionHistoryHandler Unit Tests', () => {
  let handler: GetExecutionHistoryHandler
  let mockHistoryDB: any

  beforeEach(() => {
    mockHistoryDB = {
      query: vi.fn().mockReturnValue({
        records: [
          {
            id: 1,
            code: '<?php echo 1;',
            output: '1',
            createdAt: '2026-07-29T12:00:00Z',
            connectionType: 'local',
            connectionName: 'Local PHP',
            duration: 15,
            exitCode: 0,
          },
        ],
        total: 1,
      }),
    }

    handler = new GetExecutionHistoryHandler(mockHistoryDB)
  })

  it('validates limit and offset parameters', async () => {
    await expect(handler.handle({ limit: 1001 })).rejects.toThrow(/Parameter "limit" must be between 1 and 1000/)
    await expect(handler.handle({ offset: -5 })).rejects.toThrow(/Parameter "offset" must be non-negative/)
  })

  it('queries execution history with default limit and offset', async () => {
    const result = await handler.handle({})

    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
    expect(result.total).toBe(1)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].code).toBe('<?php echo 1;')
    expect(result.records[0].status).toBe('success')
  })

  it('passes filter options to history DB query method', async () => {
    const filter = {
      connectionType: 'docker',
      status: 'error' as const,
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    }

    await handler.handle({ limit: 20, offset: 10, filter })

    expect(mockHistoryDB.query).toHaveBeenCalledWith({
      limit: 20,
      offset: 10,
      connectionType: 'docker',
      status: 'error',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    })
  })
})
