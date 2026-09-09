import { ipcMain, Notification } from 'electron'
import { Client } from './client.interface'
import type { ClientConnectionConfig } from '../../types/client-connection.type'
import { parseExecutionResult } from '../../shared/execution-result'
import { createClient } from './factory'
import type { StreamEvent } from './stream-output'

interface ClientRequestPayload {
  connection: ClientConnectionConfig
}

interface ConnectPayload extends ClientRequestPayload {
  data?: { setup?: boolean }
}

interface ExecutePayload extends ClientRequestPayload {
  code: string
  loader?: string
  tabId?: string
  streaming?: boolean
}

interface ActionPayload extends ClientRequestPayload {
  type: string
  data?: unknown
}

interface InfoPayload extends ClientRequestPayload {
  loader?: string
}

export const init = async () => {
  ipcMain.on('client:connect', connect)
  ipcMain.on('client:execute', execute)
  ipcMain.on('client:action', action)
  ipcMain.on('client:info', info)
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

const connect = async (event: Electron.IpcMainEvent, payload: ConnectPayload) => {
  let client: Client | null = null
  try {
    client = getClient(payload)
    await client.connect()
    if (payload.data?.setup) {
      await client.setup()
    }
    event.reply('client:connect:reply', {
      connected: true,
      connection: client.getConnection(),
      data: payload.data,
    })
  } catch (error: unknown) {
    event.reply('client:connect:reply', {
      connected: false,
      connection: client?.getConnection() ?? null,
      data: payload.data,
      error,
    })
    new Notification({
      title: 'Error',
      body: toErrorMessage(error),
    }).show()
  } finally {
    client?.disconnect()
  }
}

const execute = async (event: Electron.IpcMainEvent, payload: ExecutePayload) => {
  let client: Client | null = null
  try {
    client = getClient(payload)
    await client.connect()

    if (payload.streaming && typeof client.executeStreaming === 'function') {
      event.reply('client:execute:stream', {
        tabId: payload.tabId,
        event: { type: 'started' },
      })

      await client.executeStreaming(payload.code, payload.loader, (streamEvent: StreamEvent) => {
        event.reply('client:execute:stream', {
          tabId: payload.tabId,
          event: streamEvent,
        })
      })

      event.reply('client:execute:reply', { streamingDone: true })
      return
    }

    const result = await client.execute(payload.code, payload.loader)
    const parsed = parseExecutionResult(result)

    event.reply('client:execute:reply', parsed.isError ? { output: parsed.output } : parsed.output)
  } catch (error: unknown) {
    event.reply('client:execute:reply', error)
  } finally {
    client?.disconnect()
  }
}

const action = async (event: Electron.IpcMainEvent, payload: ActionPayload) => {
  let client: Client | null = null
  try {
    client = getClient(payload)
    await client.connect()
    const result = await client.action(payload.type, payload.data)
    event.reply('client:action:reply', {
      type: payload.type,
      result,
    })
  } catch (error: unknown) {
    event.reply('client:action:reply', {
      type: payload.type,
      error,
    })
  } finally {
    client?.disconnect()
  }
}

const info = async (event: Electron.IpcMainEvent, payload: InfoPayload) => {
  let client: Client | null = null
  try {
    client = getClient(payload)
    await client.connect()
    const result = await client.info(payload.loader)
    event.reply('client:info:reply', result)
  } catch (error: unknown) {
    event.reply('client:info:reply', error)
  } finally {
    client?.disconnect()
  }
}

const getClient = (payload: ClientRequestPayload): Client => {
  return createClient(payload.connection)
}
