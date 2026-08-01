/**
 * Execute PHP Tool Handler
 * Executes PHP code through TweakPHP's execution clients
 */

import { ExecutePhpParams } from './schemas'
import { MCPErrorCode } from '../types'
import { ConnectionManager } from '../connection-manager'
import { ExecutionHistoryDB } from '../execution-history-db'
import { getErrorHandler } from '../error-handler'

interface ExecutePhpResult {
  output: unknown
  exitCode: number
  duration: number
  connectionType: string
  connectionName: string
}

export class ExecutePhpHandler {
  private connectionManager: ConnectionManager
  private historyDB: ExecutionHistoryDB
  private errorHandler = getErrorHandler()
  private defaultTimeout = 30000 // 30 seconds

  constructor(connectionManager: ConnectionManager, historyDB: ExecutionHistoryDB) {
    this.connectionManager = connectionManager
    this.historyDB = historyDB
  }

  async handle(params: ExecutePhpParams): Promise<ExecutePhpResult> {
    // Validate parameters
    if (!params.code || typeof params.code !== 'string') {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "code" is required and must be a string'
      )
    }

    // Determine which connection to use
    let connection = params.connectionId
      ? this.connectionManager.getConnection(params.connectionId)
      : this.connectionManager.getActiveConnection()

    if (!connection) {
      throw this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        'No active connection available. Please specify a connectionId or set an active connection.'
      )
    }

    // Get the appropriate client
    const client = this.connectionManager.getClient(connection)
    const timeout = params.timeout || this.defaultTimeout
    const startTime = Date.now()

    try {
      // Connect to the client with retry logic
      await this.errorHandler.executeWithRetry(
        () => client.connect(),
        'execute_php:connect',
        2, // max 2 retries for connection
        1000 // 1 second base delay
      )
      // Execute with timeout
      const result = await this.executeWithTimeout(() => client.execute(params.code), timeout)

      const duration = Date.now() - startTime

      // Parse the result
      const trimmed = result.trim()
      const tweakphpResult = trimmed.split('TWEAKPHP_RESULT:')[1]?.trim()
      let output: unknown = trimmed

      if (tweakphpResult) {
        try {
          output = JSON.parse(tweakphpResult)
        } catch {
          output = tweakphpResult
        }
      }

      // Save to execution history
      this.historyDB.insert({
        code: params.code,
        output: typeof output === 'string' ? output : JSON.stringify(output),
        exitCode: 0,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        duration,
      })

      return {
        output,
        exitCode: 0,
        duration,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
      }
    } catch (err: any) {
      const duration = Date.now() - startTime
      // Save failed execution to history
      this.historyDB.insert({
        code: params.code,
        error: err.message,
        exitCode: 1,
        connectionType: connection.type,
        connectionName: this.connectionManager.getConnectionName(connection),
        duration,
      })

      // Check if it's a timeout error
      if (err.message === 'TIMEOUT') {
        const timeoutError = this.errorHandler.createError(
          MCPErrorCode.TIMEOUT,
          `PHP code execution exceeded timeout of ${timeout}ms`,
          {
            timeout,
            duration,
            connectionType: connection.type,
          }
        )
        throw this.errorHandler.enhanceErrorWithTroubleshooting(timeoutError)
      }

      // Check if it's a PHP syntax or execution error
      if (err.message && (err.message.includes('Parse error') || err.message.includes('Fatal error'))) {
        const execError = this.errorHandler.createError(MCPErrorCode.EXECUTION_ERROR, 'PHP execution error', {
          phpError: err.message,
          duration,
          connectionType: connection.type,
        })
        throw this.errorHandler.enhanceErrorWithTroubleshooting(execError)
      }

      // Use error handler to classify and enhance the error
      throw this.errorHandler.enhanceErrorWithTroubleshooting(this.errorHandler.toMCPError(err), connection.type)
    } finally {
      try {
        await client.disconnect()
      } catch (disconnectErr) {
        // Log disconnect errors but don't throw
        console.error('Failed to disconnect client:', disconnectErr)
      }
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([fn(), new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout))])
  }
}
