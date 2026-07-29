/**
 * MCP Server Implementation
 * Uses the official @modelcontextprotocol/sdk with StreamableHTTPServerTransport.
 * Runs inside Electron's bundled Node.js — no system Node.js required on the host machine.
 *
 * MCP client config (Claude Desktop, Cursor, VS Code, etc.):
 *   { "url": "http://127.0.0.1:<port>/mcp", "type": "http" }
 *
 * Stateless pattern: a fresh McpServer + transport is created per POST /mcp request.
 * Shared state (ConnectionManager, ExecutionHistoryDB) lives on MCPServerImpl and is
 * accessed via closure from each per-request server instance.
 */

import * as http from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { MCPServerConfig, MCPServerStatus } from './types'
import { getErrorLogger } from './error-logger'
import { ConnectionManager } from './connection-manager'
import { ExecutionHistoryDB } from './execution-history-db'
import { ExecutePhpHandler } from './tools/execute-php'
import { ExecuteWithLoaderHandler } from './tools/execute-with-loader'
import { GetExecutionHistoryHandler } from './tools/get-execution-history'
import { SwitchConnectionHandler } from './tools/switch-connection'
import { GetPhpInfoHandler } from './tools/get-php-info'
import { ListConnectionsHandler } from './tools/list-connections'

export interface MCPServer {
  start(config: MCPServerConfig): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  getStatus(): MCPServerStatus
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
  private historyDB: ExecutionHistoryDB
  private executePhpHandler: ExecutePhpHandler
  private executeWithLoaderHandler: ExecuteWithLoaderHandler
  private getExecutionHistoryHandler: GetExecutionHistoryHandler
  private switchConnectionHandler: SwitchConnectionHandler
  private getPhpInfoHandler: GetPhpInfoHandler
  private listConnectionsHandler: ListConnectionsHandler

  constructor() {
    this.connectionManager = new ConnectionManager()
    this.historyDB = new ExecutionHistoryDB()
    this.executePhpHandler = new ExecutePhpHandler(this.connectionManager, this.historyDB)
    this.executeWithLoaderHandler = new ExecuteWithLoaderHandler(this.connectionManager, this.historyDB)
    this.getExecutionHistoryHandler = new GetExecutionHistoryHandler(this.historyDB)
    this.switchConnectionHandler = new SwitchConnectionHandler(this.connectionManager)
    this.getPhpInfoHandler = new GetPhpInfoHandler(this.connectionManager)
    this.listConnectionsHandler = new ListConnectionsHandler(this.connectionManager)
  }

  /**
   * Build a fresh McpServer for a single request.
   * Tool handlers close over the shared state on this instance.
   */
  private buildMcpServer(): McpServer {
    const server = new McpServer({ name: 'tweakphp', version: '0.12.1' })

    server.tool(
      'execute_php',
      'Execute PHP code in the active TweakPHP connection (local, Docker, SSH, kubectl, or Vapor)',
      {
        code: z.string().describe('PHP code to execute'),
        connectionId: z.string().optional().describe('Connection ID (uses active connection if omitted)'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
      },
      async ({ code, connectionId, timeout }) => {
        this.requestCount++
        try {
          const result = await this.executePhpHandler.handle({ code, connectionId, timeout })
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
      }
    )

    server.tool(
      'execute_with_loader',
      'Execute PHP code with a Laravel or Symfony framework context loaded',
      {
        code: z.string().describe('PHP code to execute'),
        loader: z.enum(['laravel', 'symfony']).describe('Framework loader to use'),
        projectPath: z.string().optional().describe('Path to the framework project root'),
        connectionId: z.string().optional().describe('Connection ID (uses active connection if omitted)'),
        timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
      },
      async ({ code, loader, projectPath, connectionId, timeout }) => {
        this.requestCount++
        try {
          const result = await this.executeWithLoaderHandler.handle({
            code,
            loader,
            projectPath,
            connectionId,
            timeout,
          })
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
      }
    )

    server.tool(
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
      async ({ limit, offset, filter }) => {
        this.requestCount++
        try {
          const result = await this.getExecutionHistoryHandler.handle({ limit, offset, filter })
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
      }
    )

    server.tool(
      'switch_connection',
      'Switch TweakPHP to a different execution environment (local, Docker, SSH, kubectl, Vapor)',
      {
        connectionId: z.string().optional().describe('ID of an existing stored connection to switch to'),
        connectionType: z
          .enum(['local', 'docker', 'ssh', 'kubectl', 'vapor'])
          .optional()
          .describe('Type of new connection to create'),
        connectionConfig: z.record(z.unknown()).optional().describe('Configuration object for the new connection'),
      },
      async ({ connectionId, connectionType, connectionConfig }) => {
        this.requestCount++
        try {
          const result = await this.switchConnectionHandler.handle({ connectionId, connectionType, connectionConfig })
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
      }
    )

    server.tool(
      'get_php_info',
      'Get PHP version and configuration details from the active connection',
      {
        section: z
          .enum(['general', 'modules', 'environment', 'variables', 'all'])
          .optional()
          .describe('Section to retrieve (default: all)'),
      },
      async ({ section }) => {
        this.requestCount++
        try {
          const result = await this.getPhpInfoHandler.handle({ section })
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
      }
    )

    server.tool(
      'list_connections',
      'List all currently configured, stored, or active execution environments (local, Docker, SSH, kubectl, Vapor)',
      {
        typeFilter: z
          .enum(['local', 'docker', 'ssh', 'kubectl', 'vapor'])
          .optional()
          .describe('Optional filter by connection type'),
        includeDiscovered: z
          .boolean()
          .optional()
          .describe('Set to true to auto-discover active Docker containers on the host'),
      },
      async ({ typeFilter, includeDiscovered }) => {
        this.requestCount++
        try {
          const result = await this.listConnectionsHandler.handle({ typeFilter, includeDiscovered })
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
      }
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
