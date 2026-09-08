import { restartLsp } from '../lsp/coordinator'
import { registerIpcHandler } from './ipc-utils'

export function registerLspIpc(): void {
  registerIpcHandler('lsp:restart', async () => {
    console.log('Received request to restart LSP server.')
    await restartLsp()
    console.log('LSP server restarted successfully.')
    return { success: true }
  })
}
