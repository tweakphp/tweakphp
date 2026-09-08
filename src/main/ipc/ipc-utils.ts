import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { ZodError } from 'zod'
import type { ZodType } from 'zod'

export interface IpcResult<T> {
  data: T | null
  error: string | null
}

export const ipcSuccess = <T>(data: T): IpcResult<T> => ({ data, error: null })

export const ipcError = (error: unknown): IpcResult<null> => ({
  data: null,
  error: error instanceof ZodError ? 'Invalid payload' : error instanceof Error ? error.message : String(error),
})

export function registerIpcHandler<P>(
  channel: string,
  handler: (payload: P, event: IpcMainInvokeEvent) => unknown,
  schema?: ZodType<P>
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, payload?: unknown) => {
    try {
      const parsed = (schema ? schema.parse(payload) : (payload as P)) as P
      return ipcSuccess(await handler(parsed, event))
    } catch (error) {
      console.error(`IPC handler '${channel}' failed:`, error)
      return ipcError(error)
    }
  })
}
