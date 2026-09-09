/**
 * Execute PHP Tool Handler
 * Executes PHP code through TweakPHP's execution clients
 */

import { Client } from '../../client/client.interface'
import { BaseExecuteHandler, ExecuteParams, ExecuteToolResult } from './execute-base'
import { ConnectionManager } from '../connection-manager'
import { ExecutionHistoryRepository } from '../../db/repositories/execution-history-repository'

export interface ExecutePhpResult extends ExecuteToolResult {}

export class ExecutePhpHandler extends BaseExecuteHandler<ExecuteParams> {
  protected readonly operation = 'execute_php'
  protected readonly defaultTimeout = 30000 // 30 seconds

  constructor(connectionManager: ConnectionManager, historyDB: ExecutionHistoryRepository) {
    super(connectionManager, historyDB)
  }

  protected async executeClient(client: Client, params: ExecuteParams): Promise<string> {
    return client.execute(params.code)
  }

  protected timeoutMessage(_params: ExecuteParams, timeout: number): string {
    return `PHP code execution exceeded timeout of ${timeout}ms`
  }
}
