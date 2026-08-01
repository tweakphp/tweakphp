import { ConnectionConfig } from '../../types/ssh.type'
import { base64Encode } from '../utils/base64-encode'
import { SSH } from '../utils/ssh'
import { RemoteClient } from './client.remote'

export class SSHClient extends RemoteClient {
  private ssh: SSH

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.ssh = new SSH(this.connection)
  }

  async connect(): Promise<void> {
    await this.ssh.connect()
  }

  protected async preSetupChecks(): Promise<void> {
    const checkPath = await this.ssh.exec(`[ -d "${this.connection.path}" ] || echo "not_found"`)
    if (checkPath.trim() === 'not_found') {
      throw new Error('Path not found')
    }

    const checkPHP = await this.ssh.exec('which php')
    if (!checkPHP.trim()) {
      throw new Error('PHP not found on remote server')
    }
  }

  async remoteExec(command: string): Promise<string> {
    return this.ssh.exec(command)
  }

  execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    return new Promise(async resolve => {
      if (!this.connection.php) {
        resolve('PHP version not found')
        return
      }
      if (!this.connection.client_path) {
        resolve('Client path not found')
        return
      }
      const command = `${this.command(projectPath)} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.ssh.exec(command)
      resolve(result)
    })
  }

  async remoteExecStream(command: string, onData: (chunk: string) => void): Promise<void> {
    return this.ssh.execStream(command, onData)
  }

  async remoteUploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ssh.uploadFile(localPath, remotePath)
  }

  async getHomePath(): Promise<string> {
    return (await this.ssh.exec('echo $HOME')).trim()
  }

  protected command(projectPath?: string): string {
    const phpPath = 'php'
    const path = projectPath || this.connection.path
    const clientPath = this.connection.client_path
    return `${phpPath} ${clientPath} ${path}`
  }

  async disconnect(): Promise<void> {
    this.ssh.disconnect()
  }
}
