import { app } from 'electron'
import { ConnectionConfig } from '../../types/ssh.type'
import { SSH } from '../utils/ssh'
import { BaseClient } from './client.base'
import path from 'path'
import { base64Encode } from '../utils/base64-encode'

export class SSHClient extends BaseClient {
  private ssh: SSH

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.ssh = new SSH(this.connection)
  }

  async connect(): Promise<void> {
    await this.ssh.connect()
  }

  async setup(): Promise<void> {
    // check path
    const checkPath = await this.ssh.exec(`[ -d "${this.connection.path}" ] || echo "not_found"`)
    if (checkPath.trim() == 'not_found') {
      throw new Error('Path not found')
    }

    // check php exists
    const checkPHP = await this.ssh.exec('which php')
    if (!checkPHP.trim()) {
      return
    }

    // get php version
    const phpVersion = (
      await this.ssh.exec(`php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`)
    ).trim()
    if (parseFloat(phpVersion) < 7.4) {
      throw new Error('PHP version must be 7.4 or higher')
    }
    this.connection.php = phpVersion

    // upload phar client
    const homePath = (await this.ssh.exec('echo $HOME')).trim()
    const pharClientRemotePath = `${homePath}/.tweakphp/client-${phpVersion}.phar`
    const pharClientLocalPath = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)
    const checkClient = await this.ssh.exec(`[ -e "${pharClientRemotePath}" ] || echo "not_found"`)
    if (checkClient.trim() == 'not_found') {
      await this.ssh.exec(`mkdir -p ${homePath}/.tweakphp`)
      await this.ssh.uploadFile(pharClientLocalPath, pharClientRemotePath)
    }
    this.connection.client_path = pharClientRemotePath
  }

  execute(code: string, loader?: string): Promise<string> {
    return new Promise(async resolve => {
      if (!this.connection.php) {
        resolve('PHP version not found')
        return
      }
      if (!this.connection.client_path) {
        resolve('Client path not found')
        return
      }
      const command = `${this.command()} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.ssh.exec(command)
      resolve(result)
    })
  }

  async info(loader?: string): Promise<string> {
    return new Promise(async resolve => {
      if (!this.connection.php || !this.connection.client_path) {
        resolve('{}')
        return
      }
      const command = `${this.command()} info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.ssh.exec(command)
      resolve(result)
    })
  }

  private command(): string {
    const phpPath = 'php'
    const path = this.connection.path
    const clientPath = this.connection.client_path
    return `${phpPath} ${clientPath} ${path}`
  }

  async disconnect(): Promise<void> {
    this.ssh.disconnect()
  }
}
