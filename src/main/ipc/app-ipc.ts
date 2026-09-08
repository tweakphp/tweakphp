import { getSettings } from '../settings'
import { registerIpcHandler } from './ipc-utils'

export function registerAppIpc(): void {
  registerIpcHandler('app:init', async () => ({
    settings: getSettings(),
  }))
}
