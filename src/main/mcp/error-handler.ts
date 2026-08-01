/**
 * MCP Error Handler
 * Provides error recovery strategies and enhanced error handling
 */

import { MCPError, MCPErrorCode } from './types'
import { getErrorLogger } from './error-logger'

export interface ErrorRecoveryStrategy {
  shouldRetry: boolean
  retryDelay?: number
  maxRetries?: number
  fallbackAction?: () => Promise<void>
}

export class ErrorHandler {
  private logger = getErrorLogger()

  /**
   * Handle an error and determine recovery strategy
   */
  handleError(error: any, tool?: string, context?: Record<string, unknown>): MCPError {
    // Convert to MCPError if not already
    const mcpError = this.toMCPError(error)

    // Log the error
    const stackTrace = error instanceof Error ? error.stack : undefined
    this.logger.logError(mcpError, tool, stackTrace)

    // Enhance error with context if provided
    if (context) {
      mcpError.details = {
        ...mcpError.details,
        ...context,
      }
    }

    return mcpError
  }

  /**
   * Convert any error to MCPError format
   */
  toMCPError(error: any): MCPError {
    // Already an MCPError (only if the code is a known MCPErrorCode value)
    if (error.code && error.message && Object.values(MCPErrorCode).includes(error.code)) {
      return error as MCPError
    }

    // Error object
    if (error instanceof Error) {
      return this.classifyError(error)
    }

    // String error
    if (typeof error === 'string') {
      return {
        code: MCPErrorCode.INTERNAL_ERROR,
        message: error,
      }
    }

    // Unknown error type
    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message: 'Unknown error occurred',
      details: { error: String(error) },
    }
  }

  /**
   * Classify an Error object into appropriate MCPErrorCode
   */
  private classifyError(error: Error): MCPError {
    const message = error.message.toLowerCase()

    // Timeout errors
    if (message.includes('timeout') || message === 'timeout') {
      return {
        code: MCPErrorCode.TIMEOUT,
        message: error.message,
      }
    }

    // Connection errors
    if (
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('network')
    ) {
      return {
        code: MCPErrorCode.CONNECTION_ERROR,
        message: error.message,
      }
    }

    // PHP execution errors
    if (
      message.includes('parse error') ||
      message.includes('fatal error') ||
      message.includes('syntax error') ||
      message.includes('php')
    ) {
      return {
        code: MCPErrorCode.EXECUTION_ERROR,
        message: error.message,
        details: this.extractPhpErrorDetails(error.message),
      }
    }

    // Not found errors
    if (message.includes('not found') || message.includes('enoent')) {
      return {
        code: MCPErrorCode.NOT_FOUND,
        message: error.message,
      }
    }

    // Validation/parameter errors
    if (message.includes('invalid') || message.includes('required') || message.includes('must be')) {
      return {
        code: MCPErrorCode.INVALID_PARAMETERS,
        message: error.message,
      }
    }

    // Default to internal error
    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message: error.message,
    }
  }

  /**
   * Extract PHP error details from error message
   */
  private extractPhpErrorDetails(message: string): Record<string, unknown> {
    const details: Record<string, unknown> = {}

    // Extract error type
    const typeMatch = message.match(/(Parse error|Fatal error|Warning|Notice|Syntax error)/i)
    if (typeMatch) {
      details.errorType = typeMatch[1]
    }

    // Extract file path
    const fileMatch = message.match(/in (.+\.php)/i)
    if (fileMatch) {
      details.file = fileMatch[1]
    }

    // Extract line number
    const lineMatch = message.match(/on line (\d+)/i)
    if (lineMatch) {
      details.line = parseInt(lineMatch[1], 10)
    }

    return details
  }

  /**
   * Determine recovery strategy for an error
   */
  getRecoveryStrategy(error: MCPError): ErrorRecoveryStrategy {
    switch (error.code) {
      case MCPErrorCode.TIMEOUT:
        // Timeouts can be retried with exponential backoff
        return {
          shouldRetry: true,
          retryDelay: 1000,
          maxRetries: 2,
        }

      case MCPErrorCode.CONNECTION_ERROR:
        // Connection errors can be retried
        return {
          shouldRetry: true,
          retryDelay: 2000,
          maxRetries: 3,
        }

      case MCPErrorCode.INTERNAL_ERROR:
        // Internal errors might be transient
        return {
          shouldRetry: true,
          retryDelay: 500,
          maxRetries: 1,
        }

      case MCPErrorCode.EXECUTION_ERROR:
      case MCPErrorCode.INVALID_PARAMETERS:
      case MCPErrorCode.NOT_FOUND:
      case MCPErrorCode.AUTHENTICATION_FAILED:
        // These errors should not be retried
        return {
          shouldRetry: false,
        }

      default:
        return {
          shouldRetry: false,
        }
    }
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    tool: string,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        attempt++

        const mcpError = this.toMCPError(error)
        const strategy = this.getRecoveryStrategy(mcpError)

        // If error is not retryable, throw immediately
        if (!strategy.shouldRetry) {
          throw this.handleError(error, tool)
        }

        // If we've exhausted retries, throw
        if (attempt >= maxRetries) {
          throw this.handleError(error, tool, {
            retriesAttempted: attempt,
            finalAttempt: true,
          })
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1)

        this.logger.logWarning(`Retrying ${tool} after error (attempt ${attempt}/${maxRetries})`, {
          error: mcpError.message,
          delay,
        })

        // Wait before retrying
        await this.sleep(delay)
      }
    }

    // This should never be reached, but TypeScript needs it
    throw this.handleError(lastError, tool)
  }

  /**
   * Execute an operation with timeout
   */
  async executeWithTimeout<T>(operation: () => Promise<T>, timeout: number, tool: string): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          this.handleError(
            {
              code: MCPErrorCode.TIMEOUT,
              message: `Operation exceeded timeout of ${timeout}ms`,
              details: { timeout },
            },
            tool
          )
        )
      }, timeout)
    })

    try {
      return await Promise.race([operation(), timeoutPromise])
    } catch (error) {
      throw this.handleError(error, tool)
    }
  }

  /**
   * Wrap an operation with comprehensive error handling
   */
  async wrapOperation<T>(
    operation: () => Promise<T>,
    tool: string,
    options?: {
      timeout?: number
      retries?: number
      context?: Record<string, unknown>
    }
  ): Promise<T> {
    try {
      // Apply timeout if specified
      if (options?.timeout) {
        const timeoutOp = () => this.executeWithTimeout(operation, options.timeout!, tool)

        // Apply retries if specified
        if (options?.retries) {
          return await this.executeWithRetry(timeoutOp, tool, options.retries)
        }

        return await timeoutOp()
      }

      // Apply retries without timeout
      if (options?.retries) {
        return await this.executeWithRetry(operation, tool, options.retries)
      }

      // Execute without timeout or retries
      return await operation()
    } catch (error) {
      throw this.handleError(error, tool, options?.context)
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Create a structured error response
   */
  createError(code: MCPErrorCode, message: string, details?: Record<string, unknown>): MCPError {
    return {
      code,
      message,
      details,
    }
  }

  /**
   * Enhance error with troubleshooting information
   */
  enhanceErrorWithTroubleshooting(error: MCPError, connectionType?: string): MCPError {
    const enhanced = { ...error }

    // Add troubleshooting tips based on error type
    if (error.code === MCPErrorCode.CONNECTION_ERROR && connectionType) {
      enhanced.details = {
        ...enhanced.details,
        troubleshooting: this.getConnectionTroubleshootingTips(connectionType),
      }
    }

    if (error.code === MCPErrorCode.EXECUTION_ERROR) {
      enhanced.details = {
        ...enhanced.details,
        troubleshooting: [
          'Check PHP syntax for errors',
          'Verify all required PHP extensions are loaded',
          'Ensure the code does not reference undefined variables or functions',
          'Check for missing dependencies or autoload issues',
        ],
      }
    }

    if (error.code === MCPErrorCode.TIMEOUT) {
      enhanced.details = {
        ...enhanced.details,
        troubleshooting: [
          'Increase the timeout value if the operation legitimately needs more time',
          'Check for infinite loops or blocking operations in the code',
          'Verify the connection is responsive',
          'Consider breaking the operation into smaller chunks',
        ],
      }
    }

    return enhanced
  }

  /**
   * Get troubleshooting tips for connection errors
   */
  private getConnectionTroubleshootingTips(connectionType: string): string[] {
    const tips: Record<string, string[]> = {
      local: [
        'Verify PHP is installed and accessible',
        'Check that the PHP path is correct',
        'Ensure PHP has execute permissions',
      ],
      docker: [
        'Verify Docker is running',
        'Check that the container exists and is running',
        'Ensure the container has PHP installed',
        'Verify Docker socket permissions',
      ],
      ssh: [
        'Verify SSH credentials are correct',
        'Check that the host is reachable',
        'Ensure SSH key permissions are correct (600)',
        'Verify PHP is installed on the remote server',
        'Check firewall rules',
      ],
      kubectl: [
        'Verify kubectl is configured correctly',
        'Check that the pod/deployment exists',
        'Ensure you have access to the cluster',
        'Verify PHP is installed in the container',
        'Check cluster connectivity',
      ],
      vapor: [
        'Verify Vapor CLI is installed and configured',
        'Check that the environment exists',
        'Ensure you have access to the Vapor project',
        'Verify API credentials are valid',
      ],
    }

    return tips[connectionType] || ['Check connection configuration and network connectivity']
  }
}

// Singleton instance
let handlerInstance: ErrorHandler | null = null

export function getErrorHandler(): ErrorHandler {
  if (!handlerInstance) {
    handlerInstance = new ErrorHandler()
  }
  return handlerInstance
}
