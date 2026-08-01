import { execFile } from 'child_process'
import path from 'path'

const KUBECTL_SETUP_TIMEOUT = 30_000
const KUBECTL_EXECUTION_TIMEOUT = 60_000

export class Kubectl {
  constructor() {}

  async getContexts(): Promise<string[]> {
    try {
      const result = (await this.run(['config', 'get-contexts', '-o', 'name'], KUBECTL_SETUP_TIMEOUT)).trim()

      if (result) {
        return result.split('\n')
      }

      return []
    } catch (error: any) {
      throw new Error(error)
    }
  }

  async getNamespaces(params: { context: string }): Promise<string[]> {
    try {
      const result = (
        await this.run(
          [
            'get',
            'namespaces',
            `--context=${params.context}`,
            '-o',
            'custom-columns=NAME:.metadata.name',
            '--no-headers',
          ],
          KUBECTL_SETUP_TIMEOUT
        )
      ).trim()

      if (result) {
        return result.split('\n')
      }

      return []
    } catch (error: any) {
      throw new Error(error)
    }
  }

  async getPods(params: { context: string; namespace: string }): Promise<string[]> {
    try {
      const result = (
        await this.run(
          [
            'get',
            'pods',
            `--context=${params.context}`,
            `--namespace=${params.namespace}`,
            '--field-selector=status.phase=Running',
            '-o',
            'custom-columns=NAME:.metadata.name',
            '--no-headers',
          ],
          KUBECTL_SETUP_TIMEOUT
        )
      ).trim()

      if (result) {
        return result.split('\n')
      }

      return []
    } catch (error: any) {
      throw new Error(error)
    }
  }

  async exec(command: string, params: { pod: string; context: string; namespace: string }): Promise<string> {
    try {
      return (
        await this.run(
          [
            'exec',
            params.pod,
            `--context=${params.context}`,
            `--namespace=${params.namespace}`,
            '--',
            'sh',
            '-lc',
            command,
          ],
          KUBECTL_EXECUTION_TIMEOUT
        )
      ).trim()
    } catch (error: any) {
      throw new Error(error)
    }
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    params: {
      pod: string
      context: string
      namespace: string
    }
  ): Promise<void> {
    try {
      const localPathApi = /^[A-Za-z]:[\\/]/.test(localPath) ? path.win32 : path
      const localFileName = localPathApi.basename(localPath)
      await this.run(
        [
          'cp',
          localFileName,
          `${params.pod}:${remotePath}`,
          `--context=${params.context}`,
          `--namespace=${params.namespace}`,
        ],
        KUBECTL_SETUP_TIMEOUT,
        localPathApi.dirname(localPath)
      )
    } catch (error: any) {
      throw new Error(error)
    }
  }

  private async run(args: string[], timeout: number, cwd?: string): Promise<string> {
    return await new Promise((resolve, reject) => {
      execFile(
        'kubectl',
        args,
        { encoding: 'utf8', shell: false, timeout, ...(cwd ? { cwd } : {}) },
        (error, stdout, stderr) => {
          if (error) {
            const message = stderr || error.message
            console.error('kubectl command failed', { args, cwd, message })
            reject(new Error(message))
            return
          }
          resolve(stdout)
        }
      )
    })
  }
}
