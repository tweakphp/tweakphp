/**
 * MCP Server Implementation
 * Uses the official @modelcontextprotocol/sdk with StreamableHTTPServerTransport.
 * Runs inside Electron's bundled Node.js — no system Node.js required on the host machine.
 *
 * MCP client config (Claude Desktop, Cursor, VS Code, etc.):
 *   { "url": "http://127.0.0.1:<port>/mcp", "type": "http" }
 *
 * Stateless pattern: a fresh McpServer + transport is created per POST /mcp request.
 * Shared state (ConnectionManager, ExecutionHistoryRepository) lives on MCPServerImpl and is
 * accessed via closure from each per-request server instance.
 */

import * as http from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z, ZodRawShape } from 'zod'
import { MCPServerConfig, MCPServerStatus } from './types'
import { getErrorLogger } from './error-logger'
import { ConnectionManager } from './connection-manager'
import { ExecutionHistoryRepository } from '../db/repositories/execution-history-repository'
import { ExecutePhpHandler } from './tools/execute-php'
import { ExecuteWithLoaderHandler } from './tools/execute-with-loader'
import { GetExecutionHistoryHandler } from './tools/get-execution-history'
import { SwitchConnectionHandler } from './tools/switch-connection'
import { GetPhpInfoHandler } from './tools/get-php-info'
import { ListConnectionsHandler } from './tools/list-connections'
import {
  ListProjectsHandler,
  CreateProjectHandler,
  UpdateProjectHandler,
  DeleteProjectHandler,
  RestoreProjectHandler,
  DuplicateProjectHandler,
  SetActiveProjectHandler,
} from './tools/projects'
import {
  ListFoldersHandler,
  CreateFolderHandler,
  UpdateFolderHandler,
  DeleteFolderHandler,
  ReorderFoldersHandler,
} from './tools/folders'
import { CreateConnectionHandler, UpdateConnectionHandler, DeleteConnectionHandler } from './tools/connections-crud'
import { connectionTypes } from '../../types/connection.type'

export interface MCPServer {
  start(config: MCPServerConfig): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  getStatus(): MCPServerStatus
  getConnectionManager(): ConnectionManager
}

export class MCPServerImpl implements MCPServer {
  private running = false
  private config: MCPServerConfig | null = null
  private startTime: number | null = null
  private requestCount = 0
  private errorCount = 0
  private logger = getErrorLogger()
  private httpServer: http.Server | null = null

  // Shared state — created once, reused across every per-request McpServer instance
  private connectionManager: ConnectionManager
  private historyDB: ExecutionHistoryRepository
  private executePhpHandler: ExecutePhpHandler
  private executeWithLoaderHandler: ExecuteWithLoaderHandler
  private getExecutionHistoryHandler: GetExecutionHistoryHandler
  private switchConnectionHandler: SwitchConnectionHandler
  private getPhpInfoHandler: GetPhpInfoHandler
  private listConnectionsHandler: ListConnectionsHandler
  private listProjectsHandler: ListProjectsHandler
  private createProjectHandler: CreateProjectHandler
  private updateProjectHandler: UpdateProjectHandler
  private deleteProjectHandler: DeleteProjectHandler
  private restoreProjectHandler: RestoreProjectHandler
  private duplicateProjectHandler: DuplicateProjectHandler
  private setActiveProjectHandler: SetActiveProjectHandler
  private listFoldersHandler: ListFoldersHandler
  private createFolderHandler: CreateFolderHandler
  private updateFolderHandler: UpdateFolderHandler
  private deleteFolderHandler: DeleteFolderHandler
  private reorderFoldersHandler: ReorderFoldersHandler
  private createConnectionHandler: CreateConnectionHandler
  private updateConnectionHandler: UpdateConnectionHandler
  private deleteConnectionHandler: DeleteConnectionHandler

  constructor() {
    this.connectionManager = new ConnectionManager()
    this.historyDB = new ExecutionHistoryRepository()
    this.executePhpHandler = new ExecutePhpHandler(this.connectionManager, this.historyDB)
    this.executeWithLoaderHandler = new ExecuteWithLoaderHandler(this.connectionManager, this.historyDB)
    this.getExecutionHistoryHandler = new GetExecutionHistoryHandler(this.historyDB)
    this.switchConnectionHandler = new SwitchConnectionHandler(this.connectionManager)
    this.getPhpInfoHandler = new GetPhpInfoHandler(this.connectionManager)
    this.listConnectionsHandler = new ListConnectionsHandler(this.connectionManager)
    this.listProjectsHandler = new ListProjectsHandler()
    this.createProjectHandler = new CreateProjectHandler()
    this.updateProjectHandler = new UpdateProjectHandler()
    this.deleteProjectHandler = new DeleteProjectHandler()
    this.restoreProjectHandler = new RestoreProjectHandler()
    this.duplicateProjectHandler = new DuplicateProjectHandler()
    this.setActiveProjectHandler = new SetActiveProjectHandler()
    this.listFoldersHandler = new ListFoldersHandler()
    this.createFolderHandler = new CreateFolderHandler()
    this.updateFolderHandler = new UpdateFolderHandler()
    this.deleteFolderHandler = new DeleteFolderHandler()
    this.reorderFoldersHandler = new ReorderFoldersHandler()
    this.createConnectionHandler = new CreateConnectionHandler(this.connectionManager)
    this.updateConnectionHandler = new UpdateConnectionHandler(this.connectionManager)
    this.deleteConnectionHandler = new DeleteConnectionHandler(this.connectionManager)
  }

  /**
   * Register a tool with the shared request/error counting wrapper.
   */
  private registerTool(
    server: McpServer,
    name: string,
    description: string,
    schema: ZodRawShape,
    handler: (args: any) => Promise<unknown>
  ): void {
    server.tool(name, description, schema, async args => {
      this.requestCount++
      try {
        const result = await handler(args)
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
      } catch (err: any) {
        this.errorCount++
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: err?.message ?? String(err), details: err?.details }),
            },
          ],
          isError: true,
        }
      }
    })
  }

  /**
   * Build a fresh McpServer for a single request.
   * Tool handlers close over the shared state on this instance.
   */
  private buildMcpServer(): McpServer {
    const server = new McpServer({ name: 'tweakphp', version: '0.14.0' })
    const register = this.registerTool.bind(this, server)

    // ------------------------------------------------------------------
    // Execution
    // ------------------------------------------------------------------

    register(
      'execute_php',
      'Execute PHP code through a TweakPHP connection (local, Docker, SSH, kubectl, or Vapor). Provide projectId to run with the connection assigned to that open project, or connectionId to use a specific stored connection.',
      {
        code: z.string().describe('PHP code to execute'),
        connectionId: z.string().optional().describe('Connection ID (required if projectId is omitted)'),
        projectId: z
          .number()
          .optional()
          .describe('Open project ID: executes with the connection assigned to this project'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
      },
      ({ code, connectionId, projectId, timeout }) =>
        this.executePhpHandler.handle({ code, connectionId, projectId, timeout })
    )

    register(
      'execute_with_loader',
      'Execute PHP code with a Laravel or Symfony framework context loaded. Use projectId to bootstrap the framework of a specific open project.',
      {
        code: z.string().describe('PHP code to execute'),
        loader: z.enum(['laravel', 'symfony']).describe('Framework loader to use'),
        projectPath: z.string().optional().describe('Path to the framework project root'),
        connectionId: z.string().optional().describe('Connection ID (required if projectId is omitted)'),
        projectId: z
          .number()
          .optional()
          .describe('Open project ID: executes with the connection assigned to this project'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
      },
      ({ code, loader, projectPath, connectionId, projectId, timeout }) =>
        this.executeWithLoaderHandler.handle({ code, loader, projectPath, connectionId, projectId, timeout })
    )

    register(
      'get_php_info',
      'Get PHP version and configuration details from the connection assigned to a specific project',
      {
        section: z
          .enum(['general', 'modules', 'environment', 'variables', 'all'])
          .optional()
          .describe('Section to retrieve (default: all)'),
        projectId: z.number().describe('Open project ID (required): uses the connection assigned to this project'),
      },
      ({ section, projectId }) => this.getPhpInfoHandler.handle({ section, projectId })
    )

    register(
      'get_execution_history',
      'Retrieve past PHP execution records from TweakPHP',
      {
        limit: z.number().optional().describe('Number of records to return (default: 50, max: 1000)'),
        offset: z.number().optional().describe('Number of records to skip (default: 0)'),
        filter: z
          .object({
            connectionType: z.string().optional(),
            status: z.enum(['success', 'error']).optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
          })
          .optional()
          .describe('Optional filter criteria'),
      },
      ({ limit, offset, filter }) => this.getExecutionHistoryHandler.handle({ limit, offset, filter })
    )

    // ------------------------------------------------------------------
    // Connections
    // ------------------------------------------------------------------

    register(
      'switch_connection',
      'Switch a project to a different execution environment (local, Docker, SSH, kubectl, Vapor): verifies the connection and assigns it to the project (the connection must belong to it). Use connectionType "local" with projectId and no config to disconnect the project back to implicit local. Without projectId the connection is only verified (and stored unassigned).',
      {
        connectionId: z.string().optional().describe('ID of an existing stored connection to switch to'),
        connectionType: z.enum(connectionTypes).optional().describe('Type of new connection to create'),
        connectionConfig: z.record(z.unknown()).optional().describe('Configuration object for the new connection'),
        projectId: z
          .number()
          .optional()
          .describe(
            'Project ID: switches/assigns the connection of this project (connections are atomic to a project)'
          ),
      },
      ({ connectionId, connectionType, connectionConfig, projectId }) =>
        this.switchConnectionHandler.handle({ connectionId, connectionType, connectionConfig, projectId })
    )

    register(
      'list_connections',
      "List execution environments. With projectId: the project's own connections and its resolved active connection. Without: all stored connections, each labelled with its owner project.",
      {
        projectId: z.number().optional().describe('Project ID: list only the connections of this project'),
        typeFilter: z.enum(connectionTypes).optional().describe('Optional filter by connection type'),
        includeDiscovered: z
          .boolean()
          .optional()
          .describe('Set to true to auto-discover active Docker containers on the host'),
      },
      ({ projectId, typeFilter, includeDiscovered }) =>
        this.listConnectionsHandler.handle({ projectId, typeFilter, includeDiscovered })
    )

    register(
      'create_connection',
      "Create a connection owned by a project (connections are atomic to a project) and set it as the project's active connection. Secrets are accepted but never returned.",
      {
        projectId: z.number().describe('Project that owns the new connection'),
        type: z.enum(connectionTypes).describe('Connection type'),
        config: z.record(z.unknown()).describe('Connection configuration (type-specific fields)'),
      },
      ({ projectId, type, config }) => this.createConnectionHandler.handle({ projectId, type, config })
    )

    register(
      'update_connection',
      'Update an existing connection. Type and project ownership cannot be changed. Projects using the connection see the new configuration automatically. Secrets are accepted but never returned.',
      {
        connectionId: z.string().describe('ID of the connection to update'),
        changes: z.record(z.unknown()).describe('Fields to merge into the stored configuration'),
      },
      ({ connectionId, changes }) => this.updateConnectionHandler.handle({ connectionId, changes })
    )

    register(
      'delete_connection',
      'Delete a connection owned by a project. The project falls back to the implicit local connection.',
      {
        connectionId: z.string().describe('ID of the connection to delete'),
      },
      ({ connectionId }) => this.deleteConnectionHandler.handle({ connectionId })
    )

    // ------------------------------------------------------------------
    // Projects (open tabs)
    // ------------------------------------------------------------------

    register(
      'list_projects',
      'List the projects currently open in TweakPHP, with their folder, pin state, tag, color and assigned connection',
      {
        includeTrashed: z.boolean().optional().describe('Include projects in the trash (default: false)'),
        folderId: z.number().optional().describe('Only return projects assigned to this folder'),
      },
      ({ includeTrashed, folderId }) => this.listProjectsHandler.handle({ includeTrashed, folderId })
    )

    register(
      'create_project',
      'Open a new project in TweakPHP (same as the frontend "Add new project")',
      {
        path: z.string().describe('Absolute path of the project'),
        name: z.string().optional().describe('Display name (defaults to the last path segment)'),
        folderId: z.number().nullable().optional().describe('Assign the project to a workspace folder'),
        color: z.string().nullable().optional().describe('Project color'),
        tag: z.string().nullable().optional().describe('Project tag'),
        code: z.string().optional().describe('Initial editor content (defaults to "<?php\\n\\n")'),
      },
      ({ path, name, folderId, color, tag, code }) =>
        this.createProjectHandler.handle({ path, name, folderId, color, tag, code })
    )

    register(
      'update_project',
      'Update an open project: write editor code, rename, change color or tag, pin/unpin, or move it to a folder (folderId null = no folder)',
      {
        projectId: z.number().describe('ID of the project'),
        name: z.string().optional().describe('New display name'),
        code: z.string().optional().describe('New editor content for the project (replaces the whole code)'),
        folderId: z.number().nullable().optional().describe('Folder to assign the project to (null to unassign)'),
        color: z.string().nullable().optional().describe('New color (null to remove)'),
        tag: z.string().nullable().optional().describe('New tag (null to remove)'),
        pinned: z.boolean().optional().describe('Pin or unpin the project'),
      },
      ({ projectId, name, code, folderId, color, tag, pinned }) =>
        this.updateProjectHandler.handle({ projectId, name, code, folderId, color, tag, pinned })
    )

    register(
      'delete_project',
      'Remove an open project (moves it to the trash, like the frontend Remove). Use force to delete permanently.',
      {
        projectId: z.number().describe('ID of the project'),
        force: z.boolean().optional().describe('Permanently delete instead of trashing (default: false)'),
      },
      ({ projectId, force }) => this.deleteProjectHandler.handle({ projectId, force })
    )

    register(
      'restore_project',
      'Restore a trashed project back to the open projects list',
      {
        projectId: z.number().describe('ID of the trashed project'),
      },
      ({ projectId }) => this.restoreProjectHandler.handle({ projectId })
    )

    register(
      'duplicate_project',
      'Duplicate an open project (code, folder, pin state and connection), like the frontend duplicate action',
      {
        projectId: z.number().describe('ID of the project to duplicate'),
      },
      ({ projectId }) => this.duplicateProjectHandler.handle({ projectId })
    )

    register(
      'set_active_project',
      'Make an open project the active one in the TweakPHP window (same as clicking it in the sidebar)',
      {
        projectId: z.number().describe('ID of the project'),
      },
      ({ projectId }) => this.setActiveProjectHandler.handle({ projectId })
    )

    // ------------------------------------------------------------------
    // Workspace folders
    // ------------------------------------------------------------------

    register('list_folders', 'List the workspace folders used to group projects', {}, () =>
      this.listFoldersHandler.handle()
    )

    register(
      'create_folder',
      'Create a new workspace folder to group projects',
      {
        name: z.string().describe('Folder name (1-100 characters)'),
      },
      ({ name }) => this.createFolderHandler.handle({ name })
    )

    register(
      'update_folder',
      'Rename a workspace folder',
      {
        folderId: z.number().describe('ID of the folder'),
        name: z.string().optional().describe('New folder name (1-100 characters)'),
      },
      ({ folderId, name }) => this.updateFolderHandler.handle({ folderId, name })
    )

    register(
      'delete_folder',
      'Delete a workspace folder. Its projects are kept and become unassigned.',
      {
        folderId: z.number().describe('ID of the folder'),
      },
      ({ folderId }) => this.deleteFolderHandler.handle({ folderId })
    )

    register(
      'reorder_folders',
      'Reorder workspace folders by providing the full ordered list of folder ids',
      {
        folderIds: z.array(z.number()).describe('All folder IDs in the desired order'),
      },
      ({ folderIds }) => this.reorderFoldersHandler.handle({ folderIds })
    )

    return server
  }

  async start(config: MCPServerConfig): Promise<void> {
    if (this.running) {
      throw new Error('MCP server is already running')
    }

    this.config = config
    this.requestCount = 0
    this.errorCount = 0

    this.httpServer = http.createServer((req, res) => {
      // Health check — used by the settings UI status polling
      if (req.method === 'GET' && req.url === '/health') {
        // Allow browser-based polling of the health endpoint from the renderer
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            status: 'ok',
            running: this.running,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            requestCount: this.requestCount,
            errorCount: this.errorCount,
          })
        )
        return
      }

      if (req.url === '/mcp') {
        // Stateless mode: only POST is valid. GET/DELETE have no session to stream or close.
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }))
          return
        }

        this.handleMcpRequest(req, res)
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    })

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(config.port, config.host, () => {
        this.running = true
        this.startTime = Date.now()
        this.logger.logInfo('MCP server started', { host: config.host, port: config.port })
        resolve()
      })

      this.httpServer!.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${config.port} is already in use`))
        } else {
          reject(error)
        }
      })
    })
  }

  /**
   * Handle a single POST /mcp request using a fresh McpServer + transport per the
   * stateless pattern documented in the MCP SDK examples.
   */
  private static readonly MAX_BODY_BYTES = 1 * 1024 * 1024 // 1 MB

  private handleMcpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Collect body first so we can pass parsedBody to handleRequest
    let body = ''
    let bodyBytes = 0
    req.on('data', chunk => {
      bodyBytes += chunk.length
      if (bodyBytes > MCPServerImpl.MAX_BODY_BYTES) {
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          // Send the response first, then destroy to stop receiving data
          res.end(
            JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Request body too large' }, id: null }),
            () => req.destroy()
          )
        }
        return
      }
      body += chunk.toString()
    })
    req.on('end', async () => {
      if (bodyBytes > MCPServerImpl.MAX_BODY_BYTES) return
      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }))
        return
      }

      const server = this.buildMcpServer()
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

      // Register cleanup before handleRequest to avoid missing a close event
      res.on('close', () => {
        transport.close()
        server.close()
      })

      try {
        await server.connect(transport)
        await transport.handleRequest(req, res, parsedBody)
      } catch (error) {
        this.logger.logError(
          { code: 'INTERNAL_ERROR', message: 'Error handling MCP request', details: { error: String(error) } },
          'mcp_request'
        )
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null })
          )
        }
      }
    })

    req.on('error', () => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Request error' }, id: null }))
    })
  }

  async stop(): Promise<void> {
    if (!this.running || !this.httpServer) return

    this.logger.logInfo('MCP server stopping', {
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
    })

    await new Promise<void>(resolve => {
      const server = this.httpServer!
      let settled = false

      const finish = (fromTimeout: boolean) => {
        if (settled) return
        settled = true
        if (fromTimeout) {
          this.logger.logWarning('Forcing MCP server shutdown after timeout')
        } else {
          this.logger.logInfo('MCP server stopped')
        }
        resolve()
      }

      server.close(() => finish(false))

      // Force-close any kept-alive connections so the server actually closes
      ;(server as any).closeAllConnections?.()

      // Hard timeout in case close() stalls
      setTimeout(() => finish(true), 5000)
    })

    this.running = false
    this.httpServer = null
    this.config = null
    this.startTime = null
  }

  isRunning(): boolean {
    return this.running
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager
  }

  getStatus(): MCPServerStatus {
    return {
      running: this.running,
      port: this.config?.port ?? 0,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
    }
  }
}

// Singleton instance
let serverInstance: MCPServerImpl | null = null

export function getMCPServer(): MCPServerImpl {
  if (!serverInstance) {
    serverInstance = new MCPServerImpl()
  }
  return serverInstance
}
