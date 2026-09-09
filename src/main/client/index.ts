import { ipcMain, Notification } from 'electron'
import { Client } from './client.interface'
import { parseExecutionResult } from '../../shared/execution-result'
import { createClient } from './factory'

export const init = async () => {
  ipcMain.on('client:connect', connect)
  ipcMain.on('client:execute', execute)
  ipcMain.on('client:action', action)
  ipcMain.on('client:info', info)
}

const connect = async (event: Electron.IpcMainEvent, payload: any) => {
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
  } catch (error: any) {
    event.reply('client:connect:reply', {
      connected: false,
      connection: client?.getConnection() ?? null,
      data: payload.data,
      error,
    })
    new Notification({
      title: 'Error',
      body: error.message ?? error,
    }).show()
  } finally {
    client?.disconnect()
  }
}

const execute = async (event: Electron.IpcMainEvent, payload: any) => {
  let client: Client | null = null
  try {
    client = getClient(payload)
    await client.connect()

    if (payload.streaming && typeof client.executeStreaming === 'function') {
      event.reply('client:execute:stream', {
        tabId: payload.tabId,
        event: { type: 'started' },
      })

      await client.executeStreaming(payload.code, payload.loader, (streamEvent: any) => {
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
  } catch (error: any) {
    event.reply('client:execute:reply', error)
  } finally {
    client?.disconnect()
  }
}

const action = async (event: Electron.IpcMainEvent, payload: any) => {
  let client: Client | null = null
  try {
    client = getClient(payload)
    await client.connect()
    const result = await client.action(payload.type, payload.data)
    event.reply('client:action:reply', {
      type: payload.type,
      result,
    })
  } catch (error: any) {
    event.reply('client:action:reply', {
      type: payload.type,
      error,
    })
  } finally {
    client?.disconnect()
  }
}

const info = async (event: Electron.IpcMainEvent, data: any) => {
  let client: Client | null = null
  try {
    client = getClient(data)
    await client.connect()
    const result = await client.info(data.loader)
    event.reply('client:info:reply', result)
  } catch (error: any) {
    event.reply('client:info:reply', error)
  } finally {
    client?.disconnect()
  }
}

const getClient = (data: any): Client => {
  return createClient(data.connection)
}
