/**
 * MCP Server Type Definitions
 * Core types for Model Context Protocol integration
 */

export interface MCPError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export enum MCPErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface MCPServerConfig {
  enabled: boolean
  port: number
  host: string
  authEnabled: boolean
  timeout: number // milliseconds
  maxConcurrentExecutions: number
}

export interface MCPServerStatus {
  running: boolean
  port: number
  uptime: number
  requestCount: number
  errorCount: number
}
