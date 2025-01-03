import { Client, ConnectConfig } from 'ssh2'
import { readFileSync } from 'fs'
import { ConnectionConfig } from '../types/ssh.type'
import { ipcMain, Notification } from 'electron'

export const init = async () => {
  ipcMain.on('ssh.connect', connect)
  ipcMain.on('ssh.open', open)
}

export const connect = (event: any, config: ConnectionConfig) => {
  const conn = new Client()
  conn
    .on('ready', () => {
      conn.exec(`[ -d "${config.path}" ] || echo "not_found"`, (err: any, stream: any) => {
        if (err) {
          handleConnectionFailed(event, config, err)
          return
        }
        let output = '';
        stream
          .on('close', () => {
            if (output.trim() == 'not_found') {
              handleConnectionFailed(event, config, { message: 'Path not found' })
            } else {
              new Notification({
                title: 'Connected',
                body: config.host,
              }).show()
              event.reply('ssh.connect.reply', {
                connected: true,
                config: config,
              })
            }
            conn.end();
          })
          .on('data', (data: any) => {
            output += data.toString();
          });
      });
    })
    .on('error', (err: any) => {
      handleConnectionFailed(event, config, err)
    })
    .connect(getConnectionConfig(config))
}

const handleConnectionFailed = (event: any, config: ConnectionConfig, error: any) => {
  new Notification({
    title: 'Error',
    body: error.message,
  }).show()
  event.reply('ssh.connect.reply', {
    connected: false,
    config: config,
  })
}

const open = (event: any, config: ConnectionConfig) => {
  const conn = new Client()
  conn
    .on('ready', () => {
      conn.exec(`php -v || echo "not_found"`, (err: any, stream: any) => {
      })
    })
    .on('error', (err: any) => {
      handleConnectionFailed(event, config, err)
    })
    .connect(getConnectionConfig(config))
}

const getConnectionConfig = (data: ConnectionConfig): ConnectConfig => {
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
    try {
      config.privateKey = readFileSync(data.privateKey, 'utf8')
    } catch (error: any) {
      //
    }
  }

  return config
}
