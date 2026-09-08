/**
 * MCP Server Module
 * Main entry point for Model Context Protocol integration
 */

import { BrowserWindow } from 'electron'
import { getMCPServer } from './server'
import { MCPServerConfig } from './types'
import { getSettings } from '../settings'
import { setMcpConnectionManager } from '../ipc/connections-ipc'

export { getMCPServer, MCPServerImpl } from './server'
export type { MCPServer } from './server'
export { ConnectionManager } from './connection-manager'
export { ExecutionHistoryRepository } from '../db/repositories/execution-history-repository'
export { getErrorHandler, ErrorHandler } from './error-handler'
export { getErrorLogger, ErrorLogger } from './error-logger'
export * from './types'
export * from './tools'

/**
 * Start MCP server with current settings
 */
export const startServerFromSettings = async (): Promise<void> => {
  const settings = getSettings()
  const server = getMCPServer()

  if (settings.mcpEnabled && !server.isRunning()) {
    const config: MCPServerConfig = {
      enabled: true,
      port: settings.mcpPort || 3000,
      host: '127.0.0.1',
      authEnabled: false,
      timeout: 30000,
      maxConcurrentExecutions: 5,
    }

    try {
      await server.start(config)
    } catch (error) {
      console.error('Failed to start MCP server:', error)
    }
  }
}

/**
 * Stop MCP server
 */
export const stopServer = async (): Promise<void> => {
  const server = getMCPServer()

  if (server.isRunning()) {
    try {
      await server.stop()
    } catch (error) {
      console.error('Failed to stop MCP server:', error)
    }
  }
}

/**
 * Send status update to all renderer windows
 */
export const broadcastStatusUpdate = () => {
  const server = getMCPServer()
  const status = server.getStatus()

  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('mcp:status-update', status)
  })
}

/**
 * Initialize MCP server
 */
export const init = async () => {
  const server = getMCPServer()

  setMcpConnectionManager(server.getConnectionManager())

  await startServerFromSettings()

  // Broadcast status updates every 2 seconds
  setInterval(() => {
    if (server.isRunning()) {
      broadcastStatusUpdate()
    }
  }, 2000)
}
