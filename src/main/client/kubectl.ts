import { ConnectionConfig } from '../../types/kubectl.type'
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
