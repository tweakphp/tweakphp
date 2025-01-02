import { Client, ConnectConfig } from 'ssh2'
import { readFileSync } from 'fs'
import { ConnectionConfig } from '../types/ssh.type'
import { ipcMain, Notification } from 'electron'

export const init = async () => {
  ipcMain.on('ssh.connect', connect)
}

export const connect = (event: any, config: ConnectionConfig) => {
  const conn = new Client()
  conn
    .on('ready', () => {
      new Notification({
        title: 'Connected',
        body: config.host,
      }).show()
      event.reply('ssh.connect.reply', {
        connected: true,
        config: config,
      })
    })
    .on('close', () => {
      new Notification({
        title: 'Connection Closed',
        body: config.host,
      }).show()
      event.reply('ssh.connect.reply', {
        connected: false,
        config: config,
      })
    })
    .connect(getConnectionConfig(config))
}

const getConnectionConfig = (data: ConnectionConfig) => {
  let config: ConnectConfig = {
    host: data.host,
    port: data.port,
    username: data.username,
    password: '',
    privateKey: '',
  }
  if (data.auth_type === 'password' && data.password) {
    config.password = data.password
  }

  if (data.auth_type === 'key' && data.privateKey) {
    config.privateKey = readFileSync(data.privateKey, 'utf8')
  }

  return config
}
