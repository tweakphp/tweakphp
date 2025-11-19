/**
 * MCP Server Implementation
 * Manages the Model Context Protocol server lifecycle
 */

import * as http from 'http'
import { MCPServerConfig, MCPServerStatus, MCPErrorCode } from './types'
import { getErrorLogger } from './error-logger'
import { ToolRouter } from './router'

export interface MCPServer {
  start(config: MCPServerConfig): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  getStatus(): MCPServerStatus
}

export class MCPServerImpl implements MCPServer {
  private running: boolean = false
  private config: MCPServerConfig | null = null
  private startTime: number | null = null
  private requestCount: number = 0
  private errorCount: number = 0
  private logger = getErrorLogger()
  private server: http.Server | null = null
  private router: ToolRouter
  private activeRequests: number = 0

  constructor() {
    this.router = new ToolRouter()
  }

  async start(config: MCPServerConfig): Promise<void> {
    if (this.running) {
      const error = new Error('MCP server is already running')
      this.logger.logWarning(error.message)
      throw error
    }

    this.config = config
    this.requestCount = 0
    this.errorCount = 0

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(error => {
        this.logger.logError(
          {
            code: MCPErrorCode.INTERNAL_ERROR,
            message: 'Unhandled error in request handler',
            details: { error: error.message },
          },
          'http_server'
        )
      })
    })

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(config.port, config.host, () => {
        this.running = true
        this.startTime = Date.now()

        // Log server startup
        this.logger.logInfo('MCP server started', {
          host: config.host,
          port: config.port,
          timeout: config.timeout,
          maxConcurrentExecutions: config.maxConcurrentExecutions,
        })

        console.log(`MCP server started on ${config.host}:${config.port}`)
        resolve()
      })

      this.server!.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          const err = new Error(`Port ${config.port} is already in use`)
          this.logger.logError(
            {
              code: MCPErrorCode.INTERNAL_ERROR,
              message: err.message,
              details: { port: config.port, host: config.host },
            },
            'http_server'
          )
          reject(err)
        } else {
          this.logger.logError(
            {
              code: MCPErrorCode.INTERNAL_ERROR,
              message: error.message,
              details: { error: error.code },
            },
            'http_server'
          )
          reject(error)
        }
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return
    }

    // Log server shutdown
    this.logger.logInfo('MCP server stopping', {
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      activeRequests: this.activeRequests,
    })

    // Close server and wait for all connections to close
    await new Promise<void>(resolve => {
      this.server!.close(() => {
        console.log('MCP server stopped')
        resolve()
      })

      // Force close after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        this.logger.logWarning('Forcing MCP server shutdown after timeout')
        resolve()
      }, 5000)
    })

    this.running = false
    this.server = null
    this.config = null
    this.startTime = null
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Set CORS headers (localhost only)
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // Health check endpoint
    if (req.method === 'GET' && req.url === '/health') {
      this.handleHealthCheck(res)
      return
    }

    // MCP tool endpoint
    if (req.method === 'POST' && req.url === '/mcp') {
      await this.handleMCPRequest(req, res)
      return
    }

    // 404 for unknown endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          details: {
            availableEndpoints: [
              { method: 'GET', path: '/health', description: 'Health check' },
              { method: 'POST', path: '/mcp', description: 'MCP tool invocation' },
            ],
          },
        },
      })
    )
  }

  private handleHealthCheck(res: http.ServerResponse): void {
    const status = this.getStatus()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        running: status.running,
        uptime: status.uptime,
        requestCount: status.requestCount,
        errorCount: status.errorCount,
        activeRequests: this.activeRequests,
        availableTools: this.router.getRegisteredTools(),
      })
    )
  }

  private async handleMCPRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Check concurrent execution limit
    if (this.config && this.activeRequests >= this.config.maxConcurrentExecutions) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: `Maximum concurrent executions (${this.config.maxConcurrentExecutions}) reached`,
            details: {
              activeRequests: this.activeRequests,
              maxConcurrentExecutions: this.config.maxConcurrentExecutions,
            },
          },
        })
      )
      this.incrementErrorCount()
      return
    }

    this.activeRequests++

    try {
      // Read request body
      const body = await this.readRequestBody(req)

      // Parse JSON
      let request
      try {
        request = JSON.parse(body)
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Invalid JSON in request body',
              details: { error: error instanceof Error ? error.message : 'Unknown error' },
            },
          })
        )
        this.incrementErrorCount()
        return
      }

      // Validate request structure
      if (!request.tool || typeof request.tool !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Request must include "tool" field as a string',
              details: { received: request },
            },
          })
        )
        this.incrementErrorCount()
        return
      }

      if (!request.parameters || typeof request.parameters !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Request must include "parameters" field as an object',
              details: { received: request },
            },
          })
        )
        this.incrementErrorCount()
        return
      }

      // Route to tool handler
      const result = await this.router.route(request)

      // Send response
      const statusCode = result.success ? 200 : 400
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))

      // Update counters
      this.incrementRequestCount()
      if (!result.success) {
        this.incrementErrorCount()
      }
    } catch (error) {
      // Handle unexpected errors
      this.logger.logError(
        {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: 'Unexpected error handling MCP request',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
        'mcp_request'
      )

      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            details: { error: error instanceof Error ? error.message : 'Unknown error' },
          },
        })
      )
      this.incrementErrorCount()
    } finally {
      this.activeRequests--
    }
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      const timeout = this.config?.timeout || 30000

      const timeoutId = setTimeout(() => {
        req.destroy()
        reject(new Error('Request body read timeout'))
      }, timeout)

      req.on('data', chunk => {
        body += chunk.toString()

        // Limit body size to 10MB
        if (body.length > 10 * 1024 * 1024) {
          clearTimeout(timeoutId)
          req.destroy()
          reject(new Error('Request body too large'))
        }
      })

      req.on('end', () => {
        clearTimeout(timeoutId)
        resolve(body)
      })

      req.on('error', error => {
        clearTimeout(timeoutId)
        reject(error)
      })
    })
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

  incrementRequestCount(): void {
    this.requestCount++
  }

  incrementErrorCount(): void {
    this.errorCount++
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
