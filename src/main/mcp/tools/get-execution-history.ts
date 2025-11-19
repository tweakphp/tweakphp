/**
 * Get Execution History Tool Handler
 * Retrieves execution history from SQLite database
 */

import { GetExecutionHistoryParams } from './schemas'
import { MCPErrorCode } from '../types'
import { ExecutionHistoryDB } from '../execution-history-db'
import { getErrorHandler } from '../error-handler'

interface ExecutionHistoryRecord {
  id: number
  code: string
  output: string
  executedAt: string
  connectionType: string
  connectionName: string
  duration: number
  exitCode: number
  status: 'success' | 'error'
}

interface GetExecutionHistoryResult {
  records: ExecutionHistoryRecord[]
  total: number
  limit: number
  offset: number
}

export class GetExecutionHistoryHandler {
  private historyDB: ExecutionHistoryDB
  private errorHandler = getErrorHandler()

  constructor(historyDB: ExecutionHistoryDB) {
    this.historyDB = historyDB
  }

  async handle(params: GetExecutionHistoryParams): Promise<GetExecutionHistoryResult> {
    const limit = params.limit || 50
    const offset = params.offset || 0

    // Validate parameters
    if (limit < 1 || limit > 1000) {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "limit" must be between 1 and 1000'
      )
    }

    if (offset < 0) {
      throw this.errorHandler.createError(MCPErrorCode.INVALID_PARAMETERS, 'Parameter "offset" must be non-negative')
    }

    try {
      // Query execution history using the database helper
      const { records, total } = this.historyDB.query({
        limit,
        offset,
        connectionType: params.filter?.connectionType,
        status: params.filter?.status,
        dateFrom: params.filter?.dateFrom,
        dateTo: params.filter?.dateTo,
      })

      // Transform records to match the expected format
      const transformedRecords: ExecutionHistoryRecord[] = records.map(record => ({
        id: record.id!,
        code: record.code,
        output: record.output || '',
        executedAt: record.createdAt!,
        connectionType: record.connectionType,
        connectionName: record.connectionName,
        duration: record.duration,
        exitCode: record.exitCode,
        status: (record.exitCode === 0 ? 'success' : 'error') as 'success' | 'error',
      }))

      return {
        records: transformedRecords,
        total,
        limit,
        offset,
      }
    } catch (error: any) {
      throw this.errorHandler.createError(MCPErrorCode.INTERNAL_ERROR, 'Failed to retrieve execution history', {
        reason: error.message,
        troubleshooting: [
          'Verify the database file is accessible',
          'Check database file permissions',
          'Ensure the database is not corrupted',
        ],
      })
    }
  }
}
