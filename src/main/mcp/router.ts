/**
 * MCP Tool Router
 * Routes tool invocations to appropriate handlers with parameter validation
 */

import { MCPToolRequest, MCPToolResponse, MCPError, MCPErrorCode } from './types'
import {
  ExecutePhpHandler,
  ExecuteWithLoaderHandler,
  GetExecutionHistoryHandler,
  SwitchConnectionHandler,
  GetPhpInfoHandler,
} from './tools'
import { ConnectionManager } from './connection-manager'
import { ExecutionHistoryDB } from './execution-history-db'
import { getErrorHandler } from './error-handler'
import { getErrorLogger } from './error-logger'

export class ToolRouter {
  private handlers: Map<string, (params: Record<string, unknown>) => Promise<unknown>> = new Map()
  private validators: Map<string, (params: Record<string, unknown>) => void> = new Map()

  // Shared infrastructure
  private connectionManager: ConnectionManager
  private historyDB: ExecutionHistoryDB
  private errorHandler = getErrorHandler()
  private errorLogger = getErrorLogger()

  // Tool handler instances
  private executePhpHandler: ExecutePhpHandler
  private executeWithLoaderHandler: ExecuteWithLoaderHandler
  private getExecutionHistoryHandler: GetExecutionHistoryHandler
  private switchConnectionHandler: SwitchConnectionHandler
  private getPhpInfoHandler: GetPhpInfoHandler

  constructor() {
    // Initialize shared infrastructure
    this.connectionManager = new ConnectionManager()
    this.historyDB = new ExecutionHistoryDB()

    // Initialize handler instances with dependencies
    this.executePhpHandler = new ExecutePhpHandler(this.connectionManager, this.historyDB)
    this.executeWithLoaderHandler = new ExecuteWithLoaderHandler(this.connectionManager, this.historyDB)
    this.getExecutionHistoryHandler = new GetExecutionHistoryHandler(this.historyDB)
    this.switchConnectionHandler = new SwitchConnectionHandler(this.connectionManager)
    this.getPhpInfoHandler = new GetPhpInfoHandler(this.connectionManager)

    // Register all tools
    this.registerAllTools()
  }

  private registerAllTools(): void {
    // Register execute_php tool
    this.registerTool(
      'execute_php',
      params => this.executePhpHandler.handle(params as any),
      this.validateExecutePhpParams
    )

    // Register execute_with_loader tool
    this.registerTool(
      'execute_with_loader',
      params => this.executeWithLoaderHandler.handle(params as any),
      this.validateExecuteWithLoaderParams
    )

    // Register get_execution_history tool
    this.registerTool(
      'get_execution_history',
      params => this.getExecutionHistoryHandler.handle(params as any),
      this.validateGetExecutionHistoryParams
    )

    // Register switch_connection tool
    this.registerTool(
      'switch_connection',
      params => this.switchConnectionHandler.handle(params as any),
      this.validateSwitchConnectionParams
    )

    // Register get_php_info tool
    this.registerTool(
      'get_php_info',
      params => this.getPhpInfoHandler.handle(params as any),
      this.validateGetPhpInfoParams
    )
  }

  registerTool(
    toolName: string,
    handler: (params: Record<string, unknown>) => Promise<unknown>,
    validator?: (params: Record<string, unknown>) => void
  ): void {
    this.handlers.set(toolName, handler)
    if (validator) {
      this.validators.set(toolName, validator)
    }
  }

  async route(request: MCPToolRequest): Promise<MCPToolResponse> {
    const handler = this.handlers.get(request.tool)

    if (!handler) {
      const error = this.errorHandler.createError(MCPErrorCode.NOT_FOUND, `Tool '${request.tool}' not found`, {
        availableTools: Array.from(this.handlers.keys()),
      })
      this.errorLogger.logError(error, request.tool)
      return this.createErrorResponse(error)
    }

    // Validate parameters if validator exists
    const validator = this.validators.get(request.tool)
    if (validator) {
      try {
        validator(request.parameters)
      } catch (error: any) {
        const mcpError = this.errorHandler.createError(
          MCPErrorCode.INVALID_PARAMETERS,
          error.message || 'Invalid parameters',
          {
            tool: request.tool,
            parameters: request.parameters,
          }
        )
        this.errorLogger.logError(mcpError, request.tool)
        return this.createErrorResponse(mcpError)
      }
    }

    try {
      // Log the request
      this.errorLogger.logInfo(`Executing tool: ${request.tool}`, {
        tool: request.tool,
        hasParameters: Object.keys(request.parameters).length > 0,
      })

      const data = await handler(request.parameters)

      // Log successful execution
      this.errorLogger.logInfo(`Tool executed successfully: ${request.tool}`)

      return {
        success: true,
        data,
      }
    } catch (error: any) {
      // Convert to MCPError and log
      const mcpError = this.errorHandler.handleError(error, request.tool, {
        parameters: request.parameters,
      })

      // Enhance error with troubleshooting if it's a connection error
      const connection = this.connectionManager.getActiveConnection()
      if (mcpError.code === MCPErrorCode.CONNECTION_ERROR && connection) {
        const enhanced = this.errorHandler.enhanceErrorWithTroubleshooting(mcpError, connection.type)
        return this.createErrorResponse(enhanced)
      }

      return this.createErrorResponse(mcpError)
    }
  }

  // Parameter validators
  private validateExecutePhpParams(params: Record<string, unknown>): void {
    if (!params.code || typeof params.code !== 'string') {
      throw new Error('Parameter "code" is required and must be a string')
    }
    if (params.connectionId !== undefined && typeof params.connectionId !== 'string') {
      throw new Error('Parameter "connectionId" must be a string')
    }
    if (params.timeout !== undefined && typeof params.timeout !== 'number') {
      throw new Error('Parameter "timeout" must be a number')
    }
  }

  private validateExecuteWithLoaderParams(params: Record<string, unknown>): void {
    if (!params.code || typeof params.code !== 'string') {
      throw new Error('Parameter "code" is required and must be a string')
    }
    if (!params.loader || !['laravel', 'symfony'].includes(params.loader as string)) {
      throw new Error('Parameter "loader" is required and must be either "laravel" or "symfony"')
    }
    if (params.projectPath !== undefined && typeof params.projectPath !== 'string') {
      throw new Error('Parameter "projectPath" must be a string')
    }
    if (params.connectionId !== undefined && typeof params.connectionId !== 'string') {
      throw new Error('Parameter "connectionId" must be a string')
    }
    if (params.timeout !== undefined && typeof params.timeout !== 'number') {
      throw new Error('Parameter "timeout" must be a number')
    }
  }

  private validateGetExecutionHistoryParams(params: Record<string, unknown>): void {
    if (params.limit !== undefined && typeof params.limit !== 'number') {
      throw new Error('Parameter "limit" must be a number')
    }
    if (params.offset !== undefined && typeof params.offset !== 'number') {
      throw new Error('Parameter "offset" must be a number')
    }
    if (params.filter !== undefined && typeof params.filter !== 'object') {
      throw new Error('Parameter "filter" must be an object')
    }
  }

  private validateSwitchConnectionParams(params: Record<string, unknown>): void {
    if (params.connectionId !== undefined && typeof params.connectionId !== 'string') {
      throw new Error('Parameter "connectionId" must be a string')
    }
    if (params.connectionType !== undefined) {
      const validTypes = ['local', 'docker', 'ssh', 'kubectl', 'vapor']
      if (!validTypes.includes(params.connectionType as string)) {
        throw new Error(`Parameter "connectionType" must be one of: ${validTypes.join(', ')}`)
      }
    }
    if (params.connectionConfig !== undefined && typeof params.connectionConfig !== 'object') {
      throw new Error('Parameter "connectionConfig" must be an object')
    }
  }

  private validateGetPhpInfoParams(params: Record<string, unknown>): void {
    if (params.section !== undefined) {
      const validSections = ['general', 'modules', 'environment', 'variables', 'all']
      if (!validSections.includes(params.section as string)) {
        throw new Error(`Parameter "section" must be one of: ${validSections.join(', ')}`)
      }
    }
  }

  private createErrorResponse(error: MCPError): MCPToolResponse {
    return {
      success: false,
      error,
    }
  }

  getRegisteredTools(): string[] {
    return Array.from(this.handlers.keys())
  }

  // Expose connection manager for external use
  getConnectionManager(): ConnectionManager {
    return this.connectionManager
  }

  // Expose history database for external use
  getHistoryDB(): ExecutionHistoryDB {
    return this.historyDB
  }
}
