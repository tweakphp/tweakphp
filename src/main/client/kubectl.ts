import { ConnectionConfig } from '../../types/kubectl.type'
import { base64Encode } from '../utils/base64-encode'
import { Kubectl } from '../utils/kubectl'
import { RemoteClient } from './client.remote'
import { buildPosixCommand } from '../utils/shell'
import { getSettings } from '../settings'

export default class KubectlClient extends RemoteClient {
  private kubectl: Kubectl

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.kubectl = new Kubectl()
  }

  async remoteExec(command: string): Promise<string> {
    return this.kubectl.exec(command, this.connection)
  }

  async remoteExecStream(command: string, onData: (chunk: string) => void): Promise<void> {
    await this.kubectl.execStream(command, this.connection, onData, this.executionTimeout)
  }

  execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    return new Promise(async resolve => {
      const command = `${this.command(projectPath)} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.kubectl.exec(command, this.connection, this.executionTimeout)
      resolve(result)
    })
  }

  async info(loader?: string): Promise<string> {
    return new Promise(async resolve => {
      const command = `${this.command()} info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      const result = await this.kubectl.exec(command, this.connection, this.executionTimeout)
      resolve(result)
    })
  }

  protected command(projectPath?: string): string {
    const phpPath = 'php'
    const path = projectPath || this.connection.path
    const clientPath = this.connection.client_path
    return buildPosixCommand(phpPath, [clientPath || '', path || ''])
  }

  private get executionTimeout(): number {
    return getSettings().dockerKubectlExecutionTimeoutSeconds * 1000
  }

  async remoteUploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.kubectl.uploadFile(localPath, remotePath, this.connection)
  }

  async getHomePath(): Promise<string> {
    return (await this.kubectl.exec('printf %s "$HOME"', this.connection)).trim()
  }

  protected getPharClientPathCandidates(homePath: string, phpVersion: string): string[] {
    const clientFileName = `client-${phpVersion}.phar`
    return [
      ...(homePath && homePath !== '/' ? [`${homePath}/.tweakphp/${clientFileName}`] : []),
      `/tmp/.tweakphp/${clientFileName}`,
    ]
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
