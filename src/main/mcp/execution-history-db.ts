/**
 * Execution History Database Helper
 * Manages execution history records in SQLite
 */

import { db } from '../db/db_manager'

export interface ExecutionHistoryRecord {
  id?: number
  code: string
  output?: string
  error?: string
  exitCode: number
  connectionType: string
  connectionName: string
  duration: number
  loader?: string
  createdAt?: string
}

export class ExecutionHistoryDB {
  /**
   * Insert a new execution history record
   */
  insert(record: ExecutionHistoryRecord): number {
    const stmt = db.prepare(`
      INSERT INTO execution_history (
        code, output, error, exit_code, connection_type, 
        connection_name, duration, loader, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      record.code,
      record.output || null,
      record.error || null,
      record.exitCode,
      record.connectionType,
      record.connectionName,
      record.duration,
      record.loader || null,
      record.createdAt || new Date().toISOString()
    )

    return result.lastInsertRowid as number
  }

  /**
   * Query execution history with filters and pagination
   */
  query(options: {
    limit?: number
    offset?: number
    connectionType?: string
    status?: 'success' | 'error'
    dateFrom?: string
    dateTo?: string
  }): { records: ExecutionHistoryRecord[]; total: number } {
    const conditions: string[] = []
    const params: any[] = []

    // Build WHERE clause
    if (options.connectionType) {
      conditions.push('connection_type = ?')
      params.push(options.connectionType)
    }

    if (options.status === 'success') {
      conditions.push('exit_code = 0')
    } else if (options.status === 'error') {
      conditions.push('exit_code != 0')
    }

    if (options.dateFrom) {
      conditions.push('created_at >= ?')
      params.push(options.dateFrom)
    }

    if (options.dateTo) {
      conditions.push('created_at <= ?')
      params.push(options.dateTo)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM execution_history
      ${whereClause}
    `)
    const countResult = countStmt.get(...params) as { total: number }
    const total = countResult?.total || 0

    // Get records with pagination
    const limit = options.limit || 50
    const offset = options.offset || 0

    const queryStmt = db.prepare(`
      SELECT 
        id,
        code,
        output,
        error,
        exit_code as exitCode,
        connection_type as connectionType,
        connection_name as connectionName,
        duration,
        loader,
        created_at as createdAt
      FROM execution_history
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)

    const records = queryStmt.all(...params, limit, offset) as ExecutionHistoryRecord[]

    return { records, total }
  }

  /**
   * Get a single execution history record by ID
   */
  getById(id: number): ExecutionHistoryRecord | undefined {
    const stmt = db.prepare(`
      SELECT 
        id,
        code,
        output,
        error,
        exit_code as exitCode,
        connection_type as connectionType,
        connection_name as connectionName,
        duration,
        loader,
        created_at as createdAt
      FROM execution_history
      WHERE id = ?
    `)

    return stmt.get(id) as ExecutionHistoryRecord | undefined
  }

  /**
   * Delete old execution history records
   */
  deleteOlderThan(days: number): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const stmt = db.prepare(`
      DELETE FROM execution_history
      WHERE created_at < ?
    `)

    const result = stmt.run(cutoffDate.toISOString())
    return result.changes
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageDuration: number
  } {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN exit_code = 0 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN exit_code != 0 THEN 1 ELSE 0 END) as failed,
        AVG(duration) as avgDuration
      FROM execution_history
    `)

    const result = stmt.get() as any

    return {
      totalExecutions: result.total || 0,
      successfulExecutions: result.successful || 0,
      failedExecutions: result.failed || 0,
      averageDuration: result.avgDuration || 0,
    }
  }
}
