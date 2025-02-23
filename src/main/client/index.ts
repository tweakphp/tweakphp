import { ipcMain, Notification } from 'electron'
import { LocalClient } from './local'
import { SSHClient } from './ssh'
import { Client } from './client.interface'
import DockerClient from './docker'
import KubectlClient from './kubectl'

export const init = async () => {
  ipcMain.on('client.connect', connect)
  ipcMain.on('client.execute', execute)
  ipcMain.on('client.action', action)
  ipcMain.on('client.info', info)
}

const connect = async (event: Electron.IpcMainEvent, payload: any) => {
  const client = getClient(payload)
  try {
    await client.connect()
    if (payload.data?.setup) {
      await client.setup()
    }
    event.reply('client.connect.reply', {
      connected: true,
      connection: client.getConnection(),
      data: payload.data,
    })
  } catch (error: any) {
    event.reply('client.connect.reply', {
      connected: false,
      connection: client.getConnection(),
      data: payload.data,
      error,
    })
    new Notification({
      title: 'Error',
      body: error.message ?? error,
    }).show()
  } finally {
    client.disconnect()
  }
}

const execute = async (event: Electron.IpcMainEvent, payload: any) => {
  const client = getClient(payload)
  try {
    await client.connect()
    let result = await client.execute(payload.code, payload.loader)
    result = result.trim()
    let output = result.split('TWEAKPHP_RESULT:')[1]?.trim()
    if (output) {
      try {
        output = JSON.parse(output)
      } catch (error: any) {
        //
      }
    }
    event.reply('client.execute.reply', output ?? result)
  } catch (error: any) {
    event.reply('client.execute.reply', error)
  } finally {
    client.disconnect()
  }
}

const action = async (event: Electron.IpcMainEvent, payload: any) => {
  const client = getClient(payload)
  try {
    await client.connect()
    const result = await client.action(payload.type, payload.data)
    event.reply('client.action.reply', {
      type: payload.type,
      result,
    })
  } catch (error: any) {
    event.reply('client.action.reply', {
      type: payload.type,
      error,
    })
  } finally {
    client.disconnect()
  }
}

const info = async (event: Electron.IpcMainEvent, data: any) => {
  const client = getClient(data)
  try {
    await client.connect()
    const result = await client.info(data.loader)
    event.reply('client.info.reply', result)
  } catch (error: any) {
    throw new Error(error)
  } finally {
    client.disconnect()
  }
}

const getClient = (data: any): Client => {
  if (!data.connection) {
    throw new Error('Connection is required')
  }

  if (data.connection.type === 'local') {
    return new LocalClient(data.connection)
  }

  if (data.connection.type === 'docker') {
    return new DockerClient(data.connection)
  }

  if (data.connection.type === 'ssh') {
    return new SSHClient(data.connection)
  }

  if (data.connection.type === 'kubectl') {
    return new KubectlClient(data.connection)
  }

  throw new Error('Type not supported')
}
