import { BaseClient, ClientActionHandler } from './client.base'
import { readFileSync } from 'fs'
import { load as yamlParse } from 'js-yaml'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { ConnectionConfig } from '../../types/vapor.type'

const execAsync = promisify(exec)

export class VaporClient extends BaseClient {
  protected blackListToken = ['<?php', '?>']

  protected actions: Record<string, ClientActionHandler> = {
    getEnvironments: async () => this.getEnvironments(),
  }

  constructor(public connection: ConnectionConfig) {
    super(connection)
  }

  async execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    const clientPath = projectPath || this.connection.client_path
    const env = this.connection.environment || 'local'

    if (!clientPath) throw new Error('Missing client path in connection configuration.')

    if (loader) {
      return 'The loader option is not supported in connection type vapor.'
    }

    const codeCleaned = this.removeBlacklistedTokens(code)
    const encoded = Buffer.from(codeCleaned).toString('base64')
    const command = `vapor tinker ${env} -n --code 'eval(base64_decode("${encoded}"));'`

    const { stdout, stderr } = await execAsync(command, { cwd: clientPath })

    if (stderr) {
      return `Error: ${stderr}`
    }

    return stdout
  }

  async info(_loader?: string): Promise<string> {
    return '{}'
  }

  /**
   * Get the list of environments defined in the vapor.yml file.
   */
  getEnvironments(): string[] {
    const clientPath = this.connection.client_path
    if (!clientPath) throw new Error('Missing client path in connection configuration.')

    const vaporPath = path.join(clientPath, 'vapor.yml')

    let vaporContent: string
    try {
      vaporContent = readFileSync(vaporPath, 'utf8')
    } catch {
      throw new Error(`vapor.yml not found in "${clientPath}". Run "vapor init" in the project first.`)
    }

    let parsed: any
    try {
      parsed = yamlParse(vaporContent)
    } catch (error: any) {
      throw new Error(`Unable to parse vapor.yml in "${clientPath}": ${error?.message ?? String(error)}`)
    }

    if (!parsed || typeof parsed !== 'object' || !('environments' in parsed)) {
      throw new Error(`No "environments" section found in vapor.yml in "${clientPath}".`)
    }

    const environments = parsed.environments
    if (!environments || typeof environments !== 'object') {
      throw new Error(`Invalid "environments" section in vapor.yml in "${clientPath}": expected a map of environments.`)
    }

    return Object.keys(environments)
  }

  /**
   * Remove blacklisted tokens from the code.
   */
  private removeBlacklistedTokens(code: string): string {
    this.blackListToken.forEach(token => {
      if (code.includes(token)) {
        code = code.replace(token, '')
      }
    })
    return code
  }
}
