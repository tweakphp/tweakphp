/**
 * MCP Tool Parameter Schemas
 * Type definitions for tool invocation parameters
 */

export interface ExecutePhpParams {
  code: string
  connectionId?: string
  projectId?: number
  timeout?: number
}

export interface ExecuteWithLoaderParams {
  code: string
  loader: 'laravel' | 'symfony'
  projectPath?: string
  connectionId?: string
  projectId?: number
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
  projectId?: number
}

export interface GetPhpInfoParams {
  section?: 'general' | 'modules' | 'environment' | 'variables' | 'all'
  projectId?: number
}

export interface ListConnectionsParams {
  projectId?: number
  typeFilter?: 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'
  includeDiscovered?: boolean
}

export interface ListProjectsParams {
  includeTrashed?: boolean
  folderId?: number
}

export interface CreateProjectParams {
  path: string
  name?: string
  folderId?: number | null
  color?: string | null
  tag?: string | null
  code?: string
}

export interface UpdateProjectParams {
  projectId: number
  name?: string
  code?: string
  folderId?: number | null
  color?: string | null
  tag?: string | null
  pinned?: boolean
}

export interface DeleteProjectParams {
  projectId: number
  force?: boolean
}

export interface RestoreProjectParams {
  projectId: number
}

export interface DuplicateProjectParams {
  projectId: number
}

export interface SetActiveProjectParams {
  projectId: number
}

export interface CreateFolderParams {
  name: string
}

export interface UpdateFolderParams {
  folderId: number
  name?: string
}

export interface DeleteFolderParams {
  folderId: number
}

export interface ReorderFoldersParams {
  folderIds: number[]
}

export interface CreateConnectionParams {
  projectId: number
  type: 'local' | 'docker' | 'ssh' | 'kubectl' | 'vapor'
  config: Record<string, unknown>
}

export interface UpdateConnectionParams {
  connectionId: string
  changes: Record<string, unknown>
}

export interface DeleteConnectionParams {
  connectionId: string
}
