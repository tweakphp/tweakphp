/**
 * Shared execution flow for the MCP execute tool handlers:
 * connection resolution, connect with retry, timeout, result parsing,
 * execution history bookkeeping, error classification and disconnect.
 */

import { Client } from '../../client/client.interface'
import { parseExecutionResult } from '../../../shared/execution-result'
import { ConnectionConfig, ConnectionManager } from '../connection-manager'
import { ExecutionHistoryRepository } from '../../db/repositories/execution-history-repository'
import { getErrorHandler } from '../error-handler'
import { MCPError, MCPErrorCode } from '../types'

export interface ExecuteParams {
  code: string
  connectionId?: string
  timeout?: number
}

export interface ExecuteToolResult {
  output: unknown
  exitCode: number
  duration: number
  connectionType: string
  connectionName: string
}

export abstract class BaseExecuteHandler<TParams extends ExecuteParams = ExecuteParams, TContext = void> {
  protected connectionManager: ConnectionManager
  protected historyDB: ExecutionHistoryRepository
  protected errorHandler = getErrorHandler()

  /** Tool label used in retry logs */
  protected abstract readonly operation: string
  /** Default execution timeout in milliseconds */
  protected abstract readonly defaultTimeout: number

  constructor(connectionManager: ConnectionManager, historyDB: ExecutionHistoryRepository) {
    this.connectionManager = connectionManager
    this.historyDB = historyDB
  }

  async handle(params: TParams): Promise<ExecuteToolResult & Record<string, unknown>> {
    this.validate(params)

    const connection = this.resolveConnection(params)
    const context = await this.prepare(params, connection)

    const client = this.connectionManager.getClient(connection)
    const timeout = params.timeout || this.defaultTimeout
    const startTime = Date.now()
    const connectionName = this.connectionManager.getConnectionName(connection)

    try {
      // Connect to the client with retry logic
      await this.errorHandler.executeWithRetry(
        () => client.connect(),
        `${this.operation}:connect`,
        2, // max 2 retries for connection
        1000 // 1 second base delay
      )

      const result = await this.executeWithTimeout(() => this.executeClient(client, params, context), timeout)
      const duration = Date.now() - startTime

      const parsed = parseExecutionResult(result)

      if (parsed.isError) {
        // The phar reported a TWEAKPHP_ERROR: the code itself failed
        const message = parsed.error?.output ?? String(parsed.output)
        this.historyDB.insert({
          code: params.code,
          error: message,
          exitCode: 1,
          connectionType: connection.type,
          connectionName,
          duration,
          ...this.historyExtra(params, context),
        })
        return {
          output: message,
          exitCode: 1,
          duration,
          connectionType: connection.type,
          connectionName,
          ...this.resultExtra(params, context),
        }
      }

      this.historyDB.insert({
        code: params.code,
        output: typeof parsed.output === 'string' ? parsed.output : JSON.stringify(parsed.output),
        exitCode: 0,
        connectionType: connection.type,
        connectionName,
        duration,
        ...this.historyExtra(params, context),
      })

      return {
        output: parsed.output,
        exitCode: 0,
        duration,
        connectionType: connection.type,
        connectionName,
        ...this.resultExtra(params, context),
      }
    } catch (err: any) {
      const duration = Date.now() - startTime

      // Save failed execution to history
      this.historyDB.insert({
        code: params.code,
        error: err.message,
        exitCode: 1,
        connectionType: connection.type,
        connectionName,
        duration,
        ...this.historyExtra(params, context),
      })

      // Tool-specific classification is thrown as-is (it carries its own details)
      const custom = this.classifyError(err, params, duration)
      if (custom) {
        throw custom
      }

      throw this.errorHandler.enhanceErrorWithTroubleshooting(
        this.mapError(err, params, timeout, duration, connection.type),
        connection.type
      )
    } finally {
      try {
        await client.disconnect()
      } catch (disconnectErr) {
        // Log disconnect errors but don't throw
        console.error('Failed to disconnect client:', disconnectErr)
      }
    }
  }

  /** Validate request parameters. The base implementation checks `code`. */
  protected validate(params: TParams): void {
    if (!params.code || typeof params.code !== 'string') {
      throw this.errorHandler.createError(
        MCPErrorCode.INVALID_PARAMETERS,
        'Parameter "code" is required and must be a string'
      )
    }
  }

  /** Resolve the connection to execute against, or throw a CONNECTION_ERROR. */
  protected resolveConnection(params: TParams) {
    const connection = params.connectionId
      ? this.connectionManager.getConnection(params.connectionId)
      : this.connectionManager.getActiveConnection()

    if (!connection) {
      throw this.errorHandler.createError(
        MCPErrorCode.CONNECTION_ERROR,
        'No active connection available. Please specify a connectionId or set an active connection.'
      )
    }

    return connection
  }

  /**
   * Hook executed after the connection is resolved and before the client is
   * built (e.g. framework detection). May throw to abort the execution.
   */
  protected async prepare(_params: TParams, _connection: ConnectionConfig): Promise<TContext> {
    return undefined as TContext
  }

  /** Run the actual execution against the client (with loader/path handling). */
  protected abstract executeClient(client: Client, params: TParams, context: TContext): Promise<string>

  /** Human-readable message used for timeout errors. */
  protected abstract timeoutMessage(params: TParams, timeout: number): string

  /** Tool-specific error classification (runs before the shared mapping). */
  protected classifyError(_err: any, _params: TParams, _duration: number): MCPError | null {
    return null
  }

  /** Extra details merged into timeout/parse/fallback MCP error details. */
  protected errorDetailsExtra(_params: TParams): Record<string, unknown> {
    return {}
  }

  /** Extra fields recorded in the execution history entries. */
  protected historyExtra(_params: TParams, _context: TContext): Record<string, unknown> {
    return {}
  }

  /** Extra fields added to successful tool results. */
  protected resultExtra(_params: TParams, _context: TContext): Record<string, unknown> {
    return {}
  }

  private mapError(err: any, params: TParams, timeout: number, duration: number, connectionType: string): MCPError {
    if (err.message === 'TIMEOUT') {
      return this.errorHandler.createError(MCPErrorCode.TIMEOUT, this.timeoutMessage(params, timeout), {
        timeout,
        duration,
        connectionType,
        ...this.errorDetailsExtra(params),
      })
    }

    if (err.message && (err.message.includes('Parse error') || err.message.includes('Fatal error'))) {
      return this.errorHandler.createError(MCPErrorCode.EXECUTION_ERROR, 'PHP execution error', {
        phpError: err.message,
        duration,
        connectionType,
        ...this.errorDetailsExtra(params),
      })
    }

    const mcpError = this.errorHandler.toMCPError(err)
    mcpError.details = {
      ...mcpError.details,
      duration,
      connectionType,
      ...this.errorDetailsExtra(params),
    }
    return mcpError
  }

  private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([fn(), new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout))])
  }
}
