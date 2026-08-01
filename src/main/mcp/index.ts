/**
 * MCP Server Module
 * Main entry point for Model Context Protocol integration
 */

import { ipcMain, BrowserWindow } from 'electron'
import { getMCPServer } from './server'
import { MCPServerConfig } from './types'
import { getSettings } from '../settings'

export { getMCPServer, MCPServerImpl } from './server'
export type { MCPServer } from './server'
export { ConnectionManager } from './connection-manager'
export { ExecutionHistoryDB } from './execution-history-db'
export { getErrorHandler, ErrorHandler } from './error-handler'
export { getErrorLogger, ErrorLogger } from './error-logger'
export * from './types'
export * from './tools'

/**
 * Start MCP server with current settings
 */
const startServerFromSettings = async (): Promise<void> => {
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
const stopServer = async (): Promise<void> => {
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
const broadcastStatusUpdate = () => {
  const server = getMCPServer()
  const status = server.getStatus()

  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('mcp.status-update', status)
  })
}

/**
 * Initialize MCP server IPC handlers
 */
export const init = async () => {
  const server = getMCPServer()

  // Handle get status requests
  ipcMain.handle('mcp.get-status', async () => {
    return server.getStatus()
  })

  // Handle start server requests
  ipcMain.handle('mcp.start', async (_event, config: MCPServerConfig) => {
    try {
      await server.start(config)
      broadcastStatusUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Handle stop server requests
  ipcMain.handle('mcp.stop', async () => {
    try {
      await server.stop()
      broadcastStatusUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Listen for settings changes to start/stop/restart server
  ipcMain.on('mcp.settings-changed', async (_event, enabled: boolean) => {
    if (enabled) {
      // Stop first to pick up any config changes (e.g. port), then restart
      if (server.isRunning()) {
        await stopServer()
      }
      await startServerFromSettings()
    } else {
      await stopServer()
    }
    broadcastStatusUpdate()
  })

  // Start server on initialization if enabled in settings
  await startServerFromSettings()

  // Broadcast status updates every 2 seconds
  setInterval(() => {
    if (server.isRunning()) {
      broadcastStatusUpdate()
    }
  }, 2000)
}
