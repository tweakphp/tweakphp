import { app } from 'electron'
import path from 'path'
import { BaseClient } from './client.base'
import { base64Encode } from '../utils/base64-encode'
import { createStreamOutputParser } from './stream-output'

export abstract class RemoteClient extends BaseClient {
  abstract remoteExec(command: string): Promise<string>
  abstract remoteUploadFile(localPath: string, remotePath: string): Promise<void>
  abstract getHomePath(): Promise<string>

  protected async preSetupChecks(): Promise<void> {}

  async setup(): Promise<void> {
    await this.preSetupChecks()

    const phpVersion = (
      await this.remoteExec(`php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`)
    ).trim()
    if (parseFloat(phpVersion) < 7.4) {
      throw new Error('PHP version must be 7.4 or higher')
    }
    this.connection.php = phpVersion

    const homePath = await this.getHomePath()
    const pharClientRemotePath = `${homePath}/.tweakphp/client-${phpVersion}.phar`
    const pharClientLocalPath = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)

    const checkClient = (await this.remoteExec(`[ -e "${pharClientRemotePath}" ] || echo "not_found"`)).trim()
    if (checkClient === 'not_found') {
      await this.remoteExec(`mkdir -p ${homePath}/.tweakphp`)
      await this.remoteUploadFile(pharClientLocalPath, pharClientRemotePath)
    }
    this.connection.client_path = pharClientRemotePath
  }

  protected command(): string {
    return `php ${this.connection.client_path} ${this.connection.path}`
  }

  remoteExecStream?(command: string, onData: (chunk: string) => void): Promise<void>

  async execute(code: string, loader?: string): Promise<string> {
    if (!this.connection.php) return 'PHP version not found'
    if (!this.connection.client_path) return 'Client path not found'
    const cmd = `${this.command()} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader!)}` : ''}`
    return this.remoteExec(cmd)
  }

  async executeStreaming(code: string, loader?: string, onEvent?: (event: any) => void): Promise<void> {
    if (!this.connection.php || !this.connection.client_path) return
    if (typeof this.remoteExecStream !== 'function') {
      throw new Error('Streaming is not supported by this connection')
    }

    const cmd = `${this.command()} execute-stream ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader!)}` : ''}`
    const parser = createStreamOutputParser(onEvent)
    await this.remoteExecStream(cmd, (chunk: string) => {
      parser.push(chunk)
    })
    parser.finish()
  }

  async info(loader?: string): Promise<string> {
    if (!this.connection.php || !this.connection.client_path) return '{}'
    const cmd = `${this.command()} info ${loader ? `--loader=${base64Encode(loader!)}` : ''}`
    return this.remoteExec(cmd)
  }
}
