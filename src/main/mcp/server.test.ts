import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MCPServerConfig } from './types'

// Mock database manager to avoid native better-sqlite3 loading issues in Vitest
vi.mock('../db/db_manager', () => ({
  db: {
    prepare: () => ({
      run: () => ({ lastInsertRowid: 1, changes: 1 }),
      get: () => ({ total: 0, successful: 0, failed: 0, avgDuration: 0 }),
      all: () => [],
    }),
  },
}))

// Mock Electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.13.3',
    getPath: () => '/tmp',
  },
}))

import { MCPServerImpl } from './server'

describe('MCPServerImpl Complete Test Suite', () => {
  let mcpServer: MCPServerImpl
  const testPort = 39876
  const host = '127.0.0.1'

  const defaultConfig: MCPServerConfig = {
    enabled: true,
    port: testPort,
    host,
    authEnabled: false,
    timeout: 30000,
    maxConcurrentExecutions: 5,
  }

  // Helper to parse SSE or direct JSON response from MCP HTTP transport
  const parseMcpResponse = async (res: Response) => {
    const text = await res.text()
    const dataLine = text.split('\n').find(line => line.startsWith('data: '))
    if (dataLine) {
      return JSON.parse(dataLine.slice(6))
    }
    return JSON.parse(text)
  }

  beforeEach(() => {
    mcpServer = new MCPServerImpl()
  })

  afterEach(async () => {
    if (mcpServer.isRunning()) {
      await mcpServer.stop()
    }
  })

  describe('Lifecycle & Status Management', () => {
    it('initializes as stopped', () => {
      expect(mcpServer.isRunning()).toBe(false)
      const status = mcpServer.getStatus()
      expect(status.running).toBe(false)
      expect(status.requestCount).toBe(0)
      expect(status.errorCount).toBe(0)
    })

    it('starts and stops successfully', async () => {
      await mcpServer.start(defaultConfig)
      expect(mcpServer.isRunning()).toBe(true)

      const status = mcpServer.getStatus()
      expect(status.running).toBe(true)
      expect(status.port).toBe(testPort)

      await mcpServer.stop()
      expect(mcpServer.isRunning()).toBe(false)
    })

    it('throws error when starting an already running server', async () => {
      await mcpServer.start(defaultConfig)
      await expect(mcpServer.start(defaultConfig)).rejects.toThrow('MCP server is already running')
    })
  })

  describe('HTTP Endpoints & Validation', () => {
    beforeEach(async () => {
      await mcpServer.start(defaultConfig)
    })

    it('responds to GET /health with status 200 and JSON payload', async () => {
      const res = await fetch(`http://${host}:${testPort}/health`)
      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')

      const data = (await res.json()) as any
      expect(data.status).toBe('ok')
      expect(data.running).toBe(true)
      expect(data.requestCount).toBe(0)
    })

    it('returns 404 for unknown endpoints', async () => {
      const res = await fetch(`http://${host}:${testPort}/unknown-route`)
      expect(res.status).toBe(404)
      const data = (await res.json()) as any
      expect(data.error).toBe('Not found')
    })

    it('returns 405 for non-POST requests to /mcp', async () => {
      const res = await fetch(`http://${host}:${testPort}/mcp`, { method: 'GET' })
      expect(res.status).toBe(405)
      const data = (await res.json()) as any
      expect(data.error.message).toBe('Method not allowed')
    })

    it('returns 400 for malformed JSON-RPC requests on /mcp', async () => {
      const res = await fetch(`http://${host}:${testPort}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-{',
      })
      expect(res.status).toBe(400)
      const data = (await res.json()) as any
      expect(data.error.code).toBe(-32700)
      expect(data.error.message).toBe('Parse error')
    })

    it('returns 413 when request body exceeds 1 MB limit', async () => {
      const largeBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'execute_php',
          arguments: {
            code: 'x'.repeat(1024 * 1024 + 100),
          },
        },
      })

      const res = await fetch(`http://${host}:${testPort}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: largeBody,
      })

      expect(res.status).toBe(413)
      const data = (await res.json()) as any
      expect(data.error.message).toBe('Request body too large')
    })
  })

  describe('MCP Protocol & Tool Executions', () => {
    beforeEach(async () => {
      await mcpServer.start(defaultConfig)
    })

    it('handles JSON-RPC tools/list request and returns registered MCP tools', async () => {
      const reqBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }

      const res = await fetch(`http://${host}:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(reqBody),
      })

      expect(res.status).toBe(200)
      const data = await parseMcpResponse(res)
      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe(1)
      expect(data.result?.tools).toBeDefined()

      const toolNames = data.result.tools.map((t: any) => t.name)
      expect(toolNames).toContain('execute_php')
      expect(toolNames).toContain('execute_with_loader')
      expect(toolNames).toContain('get_execution_history')
      expect(toolNames).toContain('switch_connection')
      expect(toolNames).toContain('get_php_info')
      expect(toolNames).toContain('list_connections')
    })

    it('executes get_execution_history tool successfully', async () => {
      const reqBody = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_execution_history',
          arguments: { limit: 5 },
        },
      }

      const res = await fetch(`http://${host}:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(reqBody),
      })

      expect(res.status).toBe(200)
      const data = await parseMcpResponse(res)
      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe(2)
      expect(data.result?.content).toBeDefined()

      const contentText = data.result.content[0].text
      const historyResult = JSON.parse(contentText)
      expect(historyResult.records).toBeDefined()
      expect(Array.isArray(historyResult.records)).toBe(true)
    })

    it('executes list_connections tool successfully', async () => {
      const reqBody = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_connections',
          arguments: {},
        },
      }

      const res = await fetch(`http://${host}:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify(reqBody),
      })

      expect(res.status).toBe(200)
      const data = await parseMcpResponse(res)
      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe(3)
      expect(data.result?.content).toBeDefined()

      const contentText = data.result.content[0].text
      const listResult = JSON.parse(contentText)
      expect(listResult.connections).toBeDefined()
      expect(Array.isArray(listResult.connections)).toBe(true)
    })
  })
})
