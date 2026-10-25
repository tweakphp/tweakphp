/**
 * MCP Tool Handlers
 * Exports all tool handler implementations
 */

export { ExecutePhpHandler } from './execute-php'
export { ExecuteWithLoaderHandler } from './execute-with-loader'
export { GetExecutionHistoryHandler } from './get-execution-history'
export { SwitchConnectionHandler } from './switch-connection'
export { GetPhpInfoHandler } from './get-php-info'
export { ListConnectionsHandler } from './list-connections'

// Projects (open tabs)
export {
  ListProjectsHandler,
  CreateProjectHandler,
  UpdateProjectHandler,
  DeleteProjectHandler,
  RestoreProjectHandler,
  DuplicateProjectHandler,
  SetActiveProjectHandler,
} from './projects'
export type { ProjectSummary } from './projects'

// Workspace folders
export {
  ListFoldersHandler,
  CreateFolderHandler,
  UpdateFolderHandler,
  DeleteFolderHandler,
  ReorderFoldersHandler,
} from './folders'

// Connections CRUD
export {
  CreateConnectionHandler,
  UpdateConnectionHandler,
  DeleteConnectionHandler,
  sanitizeConnection,
} from './connections-crud'

// Shared
export { resolveProjectConnection, getProjectTab } from './project-connection'

export * from './schemas'
