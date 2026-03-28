/**
 * MCP Server Implementation
 * Uses the official @modelcontextprotocol/sdk with StreamableHTTPServerTransport.
 * Runs inside Electron's bundled Node.js — no system Node.js required on the host machine.
 *
 * MCP client config (Claude Desktop, Cursor, VS Code, etc.):
 *   { "url": "http://127.0.0.1:<port>/mcp", "type": "http" }
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

  private connectionManager: ConnectionManager
  private historyDB: ExecutionHistoryDB

  constructor() {
    this.connectionManager = new ConnectionManager()
    this.historyDB = new ExecutionHistoryDB()
  }

  async start(config: MCPServerConfig): Promise<void> {
    if (this.running) {
      throw new Error('MCP server is already running')
    }

    this.config = config
    this.requestCount = 0
    this.errorCount = 0

    // Build MCP server using the official SDK
    const mcpServer = new McpServer({ name: 'tweakphp', version: '0.12.1' })

    const executePhpHandler = new ExecutePhpHandler(this.connectionManager, this.historyDB)
    const executeWithLoaderHandler = new ExecuteWithLoaderHandler(this.connectionManager, this.historyDB)
    const getExecutionHistoryHandler = new GetExecutionHistoryHandler(this.historyDB)
    const switchConnectionHandler = new SwitchConnectionHandler(this.connectionManager)
    const getPhpInfoHandler = new GetPhpInfoHandler(this.connectionManager)

    mcpServer.tool(
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
          const result = await executePhpHandler.handle({ code, connectionId, timeout })
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        } catch (err: any) {
          this.errorCount++
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: err?.message ?? String(err), details: err?.details }) }],
            isError: true,
          }
        }
      }
    )

    mcpServer.tool(
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
          const result = await executeWithLoaderHandler.handle({ code, loader, projectPath, connectionId, timeout })
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        } catch (err: any) {
          this.errorCount++
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: err?.message ?? String(err), details: err?.details }) }],
            isError: true,
          }
        }
      }
    )

    mcpServer.tool(
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
          const result = await getExecutionHistoryHandler.handle({ limit, offset, filter })
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        } catch (err: any) {
          this.errorCount++
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: err?.message ?? String(err), details: err?.details }) }],
            isError: true,
          }
        }
      }
    )

    mcpServer.tool(
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
          const result = await switchConnectionHandler.handle({ connectionId, connectionType, connectionConfig })
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        } catch (err: any) {
          this.errorCount++
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: err?.message ?? String(err), details: err?.details }) }],
            isError: true,
          }
        }
      }
    )

    mcpServer.tool(
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
          const result = await getPhpInfoHandler.handle({ section })
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
        } catch (err: any) {
          this.errorCount++
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: err?.message ?? String(err), details: err?.details }) }],
            isError: true,
          }
        }
      }
    )

    // Stateless transport — no session management needed for a local desktop app
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await mcpServer.connect(transport)

    // HTTP server that routes /mcp to the SDK transport and keeps /health for monitoring
    this.httpServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      if (req.method === 'GET' && req.url === '/health') {
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
        transport.handleRequest(req, res)
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
        console.log(`MCP server started on ${config.host}:${config.port}`)
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

  async stop(): Promise<void> {
    if (!this.running || !this.httpServer) return

    this.logger.logInfo('MCP server stopping', {
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
    })

    await new Promise<void>(resolve => {
      this.httpServer!.close(() => {
        console.log('MCP server stopped')
        resolve()
      })
      // Force-close after 5 s if graceful shutdown stalls
      setTimeout(resolve, 5000)
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
