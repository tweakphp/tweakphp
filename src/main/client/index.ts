import { ipcMain, Notification } from 'electron'
import { LocalClient } from './local'
import { SSHClient } from './ssh'
import { Client } from './client.interface'
import DockerClient from './docker'
import KubectlClient from './kubectl'

export const init = async () => {
  ipcMain.on('client.setup', setup)
  ipcMain.on('client.execute', execute)
  ipcMain.on('client.action', action)
  ipcMain.on('client.info', info)
}

const setup = async (event: Electron.IpcMainEvent, data: any) => {
  const client = getClient(data)
  try {
    await client.connect()
    await client.setup()
    event.reply('client.setup.reply', {
      connected: true,
      connection: client.getConnection(),
      data: data.data,
    })
  } catch (error: any) {
    event.reply('client.setup.reply', {
      connected: false,
      connection: client.getConnection(),
      data: data.data,
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

const execute = async (event: Electron.IpcMainEvent, data: any) => {
  const client = getClient(data)
  try {
    await client.connect()
    let result = await client.execute(data.code)
    result = result.trim()
    if (result.startsWith('"') && result.endsWith('"')) {
      result = result.slice(1, -1)
    }
    event.reply('client.execute.reply', result)
  } catch (error: any) {
    event.reply('client.execute.reply', error)
  } finally {
    client.disconnect()
  }
}

const action = async (event: Electron.IpcMainEvent, data: any) => {
  const client = getClient(data)
  try {
    await client.connect()
    const result = await client.action(data.type, data.data)
    event.reply('client.action.reply', {
      type: data.type,
      result,
    })
  } catch (error: any) {
    event.reply('client.action.reply', {
      type: data.type,
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
    const result = await client.info()
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
