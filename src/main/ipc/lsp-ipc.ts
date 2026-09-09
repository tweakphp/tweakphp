import { restartLsp } from '../lsp/coordinator'
import { registerIpcHandler } from './ipc-utils'

export function registerLspIpc(): void {
  registerIpcHandler('lsp:restart', async () => {
    console.log('Received request to restart LSP server.')
    const success = await restartLsp()
    if (!success) {
      console.error('LSP server failed to restart.')
      return { error: 'Failed to restart the PHP language server' }
    }
    console.log('LSP server restarted successfully.')
    return { success: true }
  })
}
