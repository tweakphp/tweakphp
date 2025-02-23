import { app } from 'electron'
import { ConnectionConfig } from '../../types/kubectl.type'
import { Kubectl } from '../utils/kubectl'
import { BaseClient } from './client.base'
import path from 'path'
import { base64Encode } from '../utils/base64-encode'

export default class KubectlClient extends BaseClient {
  private kubectl: Kubectl

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.kubectl = new Kubectl()
  }

  async setup(): Promise<void> {
    const phpVersion = (
      await this.kubectl.exec(`php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`, this.connection)
    ).trim()
    if (parseFloat(phpVersion) < 7.4) {
      throw new Error('PHP version must be at least 7.4')
    }
    this.connection.php = phpVersion

    const homePath = (await this.kubectl.exec(`sh -c 'echo $HOME'`, this.connection)).trim()
    const pharClientRemotePath = `${homePath}/.tweakphp/client-${phpVersion}.phar`
    const pharClientLocalPath = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)
    const checkClient = (
      await this.kubectl.exec(`[ -e "${pharClientRemotePath}" ] || echo "not_found"`, this.connection)
    ).trim()
    if (checkClient == 'not_found') {
      await this.kubectl.exec(`mkdir -p ${homePath}/.tweakphp`, this.connection)
      await this.kubectl.uploadFile(pharClientLocalPath, pharClientRemotePath, this.connection)
    }
    this.connection.client_path = pharClientRemotePath
  }

  execute(code: string, loader?: string): Promise<string> {
    return new Promise(async resolve => {
      const command = `${this.command()} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
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

  private command(): string {
    const phpPath = 'php'
    const path = this.connection.path
    const clientPath = this.connection.client_path
    return `${phpPath} ${clientPath} ${path}`
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
