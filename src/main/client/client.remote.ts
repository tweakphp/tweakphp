import { app } from 'electron'
import path from 'path'
import { BaseClient } from './client.base'
import { base64Encode } from '../utils/base64-encode'
import { createStreamOutputParser } from './stream-output'
import { buildPosixCommand, quotePosixShellArg } from '../utils/shell'

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

    const pharClientLocalPath = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)

    let homePath = ''
    let homePathError: unknown
    try {
      homePath = await this.getHomePath()
    } catch (error) {
      homePathError = error
    }

    const candidates = this.getPharClientPathCandidates(homePath, phpVersion)
    const errors: string[] = homePathError ? [String(homePathError)] : []
    for (const pharClientRemotePath of candidates) {
      try {
        const checkClient = (
          await this.remoteExec(`[ -e ${quotePosixShellArg(pharClientRemotePath)} ] || printf '%s\\n' not_found`)
        ).trim()
        if (checkClient === 'not_found') {
          await this.remoteExec(buildPosixCommand('mkdir', ['-p', path.posix.dirname(pharClientRemotePath)]))
          await this.remoteUploadFile(pharClientLocalPath, pharClientRemotePath)
        }
        this.connection.client_path = pharClientRemotePath
        return
      } catch (error) {
        errors.push(`${pharClientRemotePath}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    throw new Error(
      `Unable to provision the TweakPHP client. Tried: ${candidates.join(', ') || 'no writable path'}. ${errors.join(' ')}`
    )
  }

  protected getPharClientPathCandidates(homePath: string, phpVersion: string): string[] {
    return homePath ? [`${homePath}/.tweakphp/client-${phpVersion}.phar`] : []
  }

  protected command(projectPath?: string): string {
    return buildPosixCommand('php', [this.connection.client_path, projectPath || this.connection.path])
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
