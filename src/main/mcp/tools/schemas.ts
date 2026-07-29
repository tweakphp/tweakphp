/**
 * MCP Tool Parameter Schemas
 * Type definitions for tool invocation parameters
 */

export interface ExecutePhpParams {
  code: string
  connectionId?: string
  timeout?: number
}

export interface ExecuteWithLoaderParams {
  code: string
  loader: 'laravel' | 'symfony'
  projectPath?: string
  connectionId?: string
  timeout?: number
}

export interface GetExecutionHistoryParams {
  limit?: number
  offset?: number
  filter?: {
    connectionType?: string
    status?: 'success' | 'error'
    dateFrom?: string
    dateTo?: string
  }
}

export interface SwitchConnectionParams {
  connectionId?: string
  connectionType?: 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'
  connectionConfig?: Record<string, unknown>
}

export interface GetPhpInfoParams {
  section?: 'general' | 'modules' | 'environment' | 'variables' | 'all'
}

export interface ListConnectionsParams {
  typeFilter?: 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'
  includeDiscovered?: boolean
}
