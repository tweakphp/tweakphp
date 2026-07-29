import { ConnectionConfig } from '../../types/kubectl.type'
import { base64Encode } from '../utils/base64-encode'
import { Kubectl } from '../utils/kubectl'
import { RemoteClient } from './client.remote'

export default class KubectlClient extends RemoteClient {
  private kubectl: Kubectl

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.kubectl = new Kubectl()
  }

  async remoteExec(command: string): Promise<string> {
    return this.kubectl.exec(command, this.connection)
  }

  execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    return new Promise(async resolve => {
      const command = `${this.command(projectPath)} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.kubectl.exec(command, this.connection)
      resolve(result)
    })
  }

  async info(loader?: string): Promise<string> {
    return new Promise(async resolve => {
      const command = `${this.command()} info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.kubectl.exec(command, this.connection)
      resolve(result)
    })
  }

  protected command(projectPath?: string): string {
    const phpPath = 'php'
    const path = projectPath || this.connection.path
    const clientPath = this.connection.client_path
    return `${phpPath} ${clientPath} ${path}`
  }

  async remoteUploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.kubectl.uploadFile(localPath, remotePath, this.connection)
  }

  async getHomePath(): Promise<string> {
    return (await this.kubectl.exec(`sh -c 'echo $HOME'`, this.connection)).trim()
  }

  // @ts-ignore
  private async getContextsAction(_data: any): Promise<any> {
    return this.kubectl.getContexts()
  }

  // @ts-ignore
  private async getNamespacesAction(_data: any): Promise<any> {
    return this.kubectl.getNamespaces(this.connection)
  }

  // @ts-ignore
  private async getPodsAction(_data: any): Promise<any> {
    return this.kubectl.getPods(this.connection)
  }
}
