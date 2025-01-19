import { Client, ConnectConfig, SFTPWrapper } from 'ssh2'
import { readFileSync } from 'fs'
import { ConnectionConfig } from '../../types/ssh.type'
import fs from 'fs'

export class SSH {
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
        .on('error', (error: any) => {
          reject(error.message)
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
