import { ConnectionConfig } from '../../types/kubectl.type'
import { Kubectl } from '../utils/kubectl'
import { RemoteClient } from './client.remote'
import { ClientActionHandler } from './client.base'
import { buildPosixCommand } from '../utils/shell'
import { getSettings } from '../settings'

export default class KubectlClient extends RemoteClient {
  private kubectl: Kubectl

  protected actions: Record<string, ClientActionHandler> = {
    getContexts: () => this.getContexts(),
    getNamespaces: () => this.getNamespaces(),
    getPods: () => this.getPods(),
  }

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.kubectl = new Kubectl()
  }

  async remoteExec(command: string): Promise<string> {
    return this.kubectl.exec(command, this.connection, this.executionTimeout)
  }

  async remoteExecStream(command: string, onData: (chunk: string) => void): Promise<void> {
    await this.kubectl.execStream(command, this.connection, onData, this.executionTimeout)
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

  private async getContexts(): Promise<unknown> {
    return this.kubectl.getContexts()
  }

  private async getNamespaces(): Promise<unknown> {
    return this.kubectl.getNamespaces(this.connection)
  }

  private async getPods(): Promise<unknown> {
    return this.kubectl.getPods(this.connection)
  }
}
