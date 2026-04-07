import { ConnectionConfig } from '../../types/ssh.type'
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

  async remoteUploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ssh.uploadFile(localPath, remotePath)
  }

  async getHomePath(): Promise<string> {
    return (await this.ssh.exec('echo $HOME')).trim()
  }

  async disconnect(): Promise<void> {
    this.ssh.disconnect()
  }
}
