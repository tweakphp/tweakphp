import { BaseClient } from './client.base'
import { readFileSync } from 'fs'
import { load as yamlParse } from 'js-yaml'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { ConnectionConfig } from '../../types/vapor.type'
import { normalizeForEval } from './complete-php-statement'

const execAsync = promisify(exec)

export class VaporClient extends BaseClient {
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

    // Eval rejects a leading open tag: normalize it. The semicolon completion
    // is a frontend (editor) concern and is intentionally not applied here.
    const codeCleaned = normalizeForEval(code)
    const encoded = Buffer.from(codeCleaned).toString('base64')
    const command = `vapor tinker ${env} -n --code 'eval(base64_decode("${encoded}"));'`

    try {
      const { stdout, stderr } = await execAsync(command, { cwd: clientPath })

      if (stderr) {
        return `Error: ${stderr}`
      }

      return stdout
    } catch (err) {
      return `Exception: ${(err as Error).message}`
    }
  }

  async info(_loader?: string): Promise<string> {
    return new Promise(async resolve => {
      resolve('{}')
    })
  }

  /**
   * Get the list of environments defined in the vapor.yml file.
   */
  getEnvironmentsAction(): string[] {
    const clientPath = this.connection.client_path
    if (!clientPath) return []

    const vaporPath = path.join(clientPath, 'vapor.yml')

    try {
      const vaporContent = readFileSync(vaporPath, 'utf8')
      const parsed = yamlParse(vaporContent)

      if (parsed && typeof parsed === 'object' && 'environments' in parsed) {
        return Object.keys((parsed as any).environments || {})
      }

      return []
    } catch (error) {
      return []
    }
  }
}
