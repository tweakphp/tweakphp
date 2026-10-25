import { BrowserWindow } from 'electron'

/**
 * Push sync: notify every renderer window that data changed in the main
 * process (e.g. writes coming from the MCP tools). Renderer stores listen
 * on these channels and reload from the database.
 */
export type AppChangeEvent = 'app:tabs:changed' | 'app:connections:changed' | 'app:folders:changed'

export function broadcastAppChange(event: AppChangeEvent, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send(event, payload)
    } catch (error) {
      console.error(`Failed to broadcast ${event}:`, error)
    }
  }
}
