import { Client, ConnectConfig, SFTPWrapper } from 'ssh2'
import { readFileSync } from 'fs'
import { ConnectionConfig } from '../types/ssh.type'
import { app, ipcMain, Notification } from 'electron'
import fs from 'fs'
import path from 'path'

class SSHClient {
  private readonly config: ConnectConfig
  private conn: Client
  private isConnected: boolean

  constructor(connectionConfig: ConnectionConfig) {
    this.config = {
      host: connectionConfig.host,
      port: connectionConfig.port,
      username: connectionConfig.username,
      password: '',
      privateKey: '',
    }
    if (connectionConfig.auth_type === 'password' && connectionConfig.password) {
      this.config.password = connectionConfig.password
    }
    if (connectionConfig.auth_type === 'key' && connectionConfig.privateKey) {
      try {
        this.config.privateKey = readFileSync(connectionConfig.privateKey, 'utf8')
      } catch (error: any) {
        //
      }
    }
    this.conn = new Client()
    this.isConnected = false
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn
        .on('ready', () => {
          this.isConnected = true
          resolve()
        })
        .on('error', err => {
          reject(err)
        })
        .connect(this.config)
    })
  }

  async exec(command: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('SSH client is not connected')
    }

    return new Promise((resolve, reject) => {
      this.conn.exec(command, (error: any, stream: any) => {
        if (error) {
          new Notification({
            title: 'Error',
            body: error.message,
          }).show()
          return reject(error)
        }
        let output = ''
        stream
          .on('close', () => {
            resolve(output)
          })
          .on('data', (data: any) => {
            output += data.toString()
          })
      })
    })
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('SSH client is not connected')
    }

    return new Promise((resolve, reject) => {
      this.conn.sftp((error: any, sftp: SFTPWrapper) => {
        if (error) return reject(error)

        const readStream = fs.createReadStream(localPath)
        const writeStream = sftp.createWriteStream(remotePath)

        writeStream
          .on('close', () => {
            resolve()
          })
          .on('error', (error: any) => {
            reject(error)
          })

        readStream.pipe(writeStream)
      })
    })
  }

  disconnect() {
    if (this.isConnected) {
      this.conn.end()
      this.isConnected = false
    }
  }
}

let sshClient: SSHClient | null = null

export const init = async () => {
  ipcMain.on('ssh.connect', connect)
  ipcMain.on('ssh.disconnect', disconnect)
}

export const connect = async (event: any, config: ConnectionConfig, data: any = {}) => {
  sshClient = new SSHClient(config)
  try {
    await sshClient.connect()

    // check path
    const checkPath = await sshClient.exec(`[ -d "${config.path}" ] || echo "not_found"`)
    if (checkPath.trim() == 'not_found') {
      handleConnectionFailed(event, config, { message: 'Path not found' }, data)
      sshClient.disconnect()
      return
    }

    // check php exists
    const checkPHP = await sshClient.exec('which php')
    if (!checkPHP.trim()) {
      handleConnected(event, config, data)
      sshClient.disconnect()
      return
    }

    // get php version
    const phpVersion = (
      await sshClient.exec(`php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`)
    ).trim()
    if (parseFloat(phpVersion) < 7.4) {
      handleConnectionFailed(event, config, { message: 'PHP version must be at least 7.4' }, data)
      sshClient.disconnect()
      return
    }
    config.php = phpVersion

    // upload phar client
    const homePath = (await sshClient.exec('echo $HOME')).trim()
    const pharClientRemotePath = `${homePath}/.tweakphp/client-${phpVersion}.phar`
    const pharClientLocalPath = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)
    const checkClient = await sshClient.exec(`[ -e "${pharClientRemotePath}" ] || echo "not_found"`)
    if (checkClient.trim() == 'not_found') {
      await sshClient.exec(`mkdir -p ${homePath}/.tweakphp`)
      await sshClient.uploadFile(pharClientLocalPath, pharClientRemotePath)
    }
    config.phar_client = pharClientRemotePath

    handleConnected(event, config, data)
  } catch (error: any) {
    handleConnectionFailed(event, config, error, data)
  } finally {
    sshClient.disconnect()
  }
}

export const exec = async (config: ConnectionConfig, command: string): Promise<string> => {
  sshClient = new SSHClient(config)
  try {
    await sshClient.connect()
    const result = await sshClient.exec(command)
    sshClient.disconnect()
    return result
  } catch (error: any) {
    sshClient.disconnect()
    throw error
  }
}

export const disconnect = async () => {
  sshClient && sshClient.disconnect()
}

export const uploadFile = async (config: ConnectionConfig, from: string, to: string): Promise<void> => {
  const sshClient = new SSHClient(config)
  try {
    await sshClient.connect()
    const result = await sshClient.uploadFile(from, to)
    sshClient.disconnect()
    return result
  } catch (error: any) {
    sshClient.disconnect()
    throw error
  }
}

const handleConnectionFailed = (event: any, config: ConnectionConfig, error: any, data: any = {}) => {
  new Notification({
    title: 'Error',
    body: error.message,
  }).show()
  event.reply('ssh.connect.reply', {
    connected: false,
    data: data,
    config: config,
  })
}

const handleConnected = (event: any, config: ConnectionConfig, data: any = {}) => {
  if (data.notify) {
    new Notification({
      title: 'Connected',
      body: config.host,
    }).show()
  }
  event.reply('ssh.connect.reply', {
    connected: true,
    data: data,
    config: config,
  })
}
