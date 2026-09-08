import { z } from 'zod'
import { getMCPServer } from '../mcp/server'
import { broadcastStatusUpdate, startServerFromSettings, stopServer } from '../mcp/index'
import { registerIpcHandler } from './ipc-utils'

const mcpServerConfigSchema = z.object({
  enabled: z.boolean(),
  port: z.coerce.number().int().positive(),
  host: z.string(),
  authEnabled: z.boolean(),
  timeout: z.coerce.number().int().positive(),
  maxConcurrentExecutions: z.coerce.number().int().positive(),
})

export function registerMcpIpc(): void {
  const server = getMCPServer()

  registerIpcHandler('mcp:get-status', async () => server.getStatus())

  registerIpcHandler(
    'mcp:start',
    async config => {
      await server.start(config)
      broadcastStatusUpdate()
      return { success: true }
    },
    mcpServerConfigSchema
  )

  registerIpcHandler('mcp:stop', async () => {
    await server.stop()
    broadcastStatusUpdate()
    return { success: true }
  })

  registerIpcHandler(
    'mcp:settings-changed',
    async enabled => {
      if (enabled) {
        if (server.isRunning()) {
          await stopServer()
        }
        await startServerFromSettings()
      } else {
        await stopServer()
      }
      broadcastStatusUpdate()
      return { success: true }
    },
    z.boolean()
  )
}
