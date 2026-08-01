import { execFile, spawn } from 'child_process'
import { ConnectionConfig } from '../../types/docker.type'
import { SSH } from '../utils/ssh'
import { BaseClient } from './client.base'
import { app } from 'electron'
import path from 'path'
import { base64Encode } from '../utils/base64-encode'
import { createStreamOutputParser } from './stream-output'
import { buildPosixCommand } from '../utils/shell'
import { getSettings } from '../settings'

const dockerPathCache: Record<string, string> = {}
const DOCKER_SETUP_TIMEOUT = 30_000

const getExecutionTimeout = () => getSettings().dockerKubectlExecutionTimeoutSeconds * 1000

const cleanParam = (val?: any): string | undefined => {
  if (typeof val === 'string' && val.trim() !== '' && val !== 'undefined' && val !== 'null') {
    return val.trim()
  }
  return undefined
}

export default class DockerClient extends BaseClient {
  private ssh: SSH | undefined

  constructor(public connection: ConnectionConfig) {
    super(connection)
    this.ssh = connection.ssh ? new SSH(connection.ssh) : undefined
  }

  async connect(): Promise<void> {
    if (this.ssh) {
      await this.ssh.connect()
    }
  }

  async setup(): Promise<void> {
    if (cleanParam(this.connection.container_name)) {
      this.connection.php_version = await this.getPHPVersion()
      this.connection.php_path = await this.getPHPPath()
      this.connection.client_path = await this.getClientPath()
    }
  }

  private async ensureConnectionConfig(): Promise<void> {
    const containerName = cleanParam(this.connection.container_name)
    if (!containerName) {
      throw new Error('Container is not selected')
    }

    if (!cleanParam(this.connection.php_path) && !cleanParam(this.connection.php)) {
      try {
        this.connection.php_path = await this.getPHPPath()
      } catch {
        // Fallback default handled in info()/execute()
      }
    }

    if (!cleanParam(this.connection.client_path)) {
      try {
        this.connection.client_path = await this.getClientPath()
      } catch {
        // Fallback default handled in info()/execute()
      }
    }
  }

  async execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    try {
      await this.ensureConnectionConfig()

      const containerName = cleanParam(this.connection.container_name)!
      const phpPathVal = cleanParam(this.connection.php_path) || cleanParam(this.connection.php) || 'php'
      const workingDirVal =
        cleanParam(projectPath) ||
        cleanParam(this.connection.working_directory) ||
        cleanParam(this.connection.path) ||
        '/var/www/html'
      const clientPathVal = cleanParam(this.connection.client_path) || '/tmp/client.phar'

      const args = ['exec', containerName, phpPathVal, clientPathVal, workingDirVal, 'execute', base64Encode(code)]
      if (loader) {
        args.push(`--loader=${base64Encode(loader)}`)
      }

      if (this.ssh) {
        return await this.ssh.exec(buildPosixCommand(await this.getDockerPath(), args), getExecutionTimeout())
      }

      return await this.runLocalDocker(args, getExecutionTimeout())
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  async executeStreaming(code: string, loader?: string, onEvent?: (event: any) => void): Promise<void> {
    try {
      await this.ensureConnectionConfig()

      const containerName = cleanParam(this.connection.container_name)!
      const phpPathVal = cleanParam(this.connection.php_path) || cleanParam(this.connection.php) || 'php'
      const workingDirVal =
        cleanParam(this.connection.working_directory) || cleanParam(this.connection.path) || '/var/www/html'
      const clientPathVal = cleanParam(this.connection.client_path) || '/tmp/client.phar'
      const args = [
        'exec',
        containerName,
        phpPathVal,
        clientPathVal,
        workingDirVal,
        'execute-stream',
        base64Encode(code),
      ]
      if (loader) {
        args.push(`--loader=${base64Encode(loader)}`)
      }

      const parser = createStreamOutputParser(onEvent)
      if (this.ssh) {
        await this.ssh.execStream(
          buildPosixCommand(await this.getDockerPath(), args),
          chunk => {
            parser.push(chunk)
          },
          getExecutionTimeout()
        )
      } else {
        await this.runLocalDockerStream(args, getExecutionTimeout(), chunk => {
          parser.push(chunk)
        })
      }
      parser.finish()
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  async info(loader?: string): Promise<string> {
    try {
      await this.ensureConnectionConfig()

      const containerName = cleanParam(this.connection.container_name)!
      const phpPathVal = cleanParam(this.connection.php_path) || cleanParam(this.connection.php) || 'php'
      const workingDirVal =
        cleanParam(this.connection.working_directory) || cleanParam(this.connection.path) || '/var/www/html'
      const clientPathVal = cleanParam(this.connection.client_path) || '/tmp/client.phar'

      const args = ['exec', containerName, phpPathVal, clientPathVal, workingDirVal, 'info']
      if (loader) {
        args.push(`--loader=${base64Encode(loader)}`)
      }

      if (this.ssh) {
        return await this.ssh.exec(buildPosixCommand(await this.getDockerPath(), args), getExecutionTimeout())
      }

      return await this.runLocalDocker(args, getExecutionTimeout())
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  async disconnect(): Promise<void> {
    return new Promise(resolve => {
      resolve()
    })
  }

  // @ts-ignore
  private async getContainersAction(_data: any): Promise<any> {
    try {
      let result
      if (this.ssh) {
        result = (
          await this.ssh.exec(
            buildPosixCommand(await this.getDockerPath(), ['ps', '--format', '{{.ID}}|{{.Names}}|{{.Image}}'])
          )
        ).trim()
      } else {
        result = (
          await this.runLocalDocker(['ps', '--format', '{{.ID}}|{{.Names}}|{{.Image}}'], DOCKER_SETUP_TIMEOUT)
        ).trim()
      }

      if (result) {
        return result.split('\n').map(line => {
          const [id, name, image] = line.split('|')
          return { id, name, image }
        })
      }

      return null
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  // @ts-ignore
  private async getPHPVersionAction(_data: any): Promise<any> {
    return await this.getPHPVersion()
  }

  private async getPHPVersion(): Promise<string> {
    const containerName = cleanParam(this.connection.container_name)
    if (!containerName) {
      throw new Error('Container is not selected')
    }
    try {
      let phpVersion
      if (this.ssh) {
        phpVersion = (
          await this.ssh.exec(
            buildPosixCommand(await this.getDockerPath(), [
              'exec',
              containerName,
              'php',
              '-r',
              "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;",
            ])
          )
        ).trim()
      } else {
        phpVersion = (
          await this.runLocalDocker(
            ['exec', containerName, 'php', '-r', "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"],
            DOCKER_SETUP_TIMEOUT
          )
        ).trim()
      }
      if (parseFloat(phpVersion) < 7.4) {
        throw new Error('PHP version must be 7.4 or higher')
      }

      return phpVersion
    } catch (error) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  private async getDockerPath(): Promise<string> {
    try {
      if (this.ssh && this.connection.ssh) {
        if (dockerPathCache[this.connection.ssh.host]) {
          return dockerPathCache[this.connection.ssh.host]
        }

        const result = await this.ssh.exec('which docker')
        const dockerPath = result.toString().trim()
        dockerPathCache[this.connection.ssh.host] = dockerPath || 'docker'
        return dockerPathCache[this.connection.ssh.host]
      }

      return 'docker'
    } catch (error) {
      if (this.connection.ssh) {
        dockerPathCache[this.connection.ssh.host] = 'docker'
      }
      return 'docker'
    }
  }

  private async getPHPPath(): Promise<string> {
    try {
      const containerName = cleanParam(this.connection.container_name)
      if (!containerName) {
        throw new Error('Container is not selected')
      }
      if (this.ssh) {
        return (
          await this.ssh.exec(buildPosixCommand(await this.getDockerPath(), ['exec', containerName, 'which', 'php']))
        ).trim()
      }

      return (await this.runLocalDocker(['exec', containerName, 'which', 'php'], DOCKER_SETUP_TIMEOUT)).trim()
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  private async getClientPath(): Promise<string> {
    const phpVersion = this.connection.php_version || '8.2'
    let getClient
    getClient = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)

    if (this.ssh) {
      const tmpClientPath = `/tmp/client-${phpVersion}.phar`
      await this.ssh.uploadFile(getClient, tmpClientPath)
      getClient = tmpClientPath
    }

    try {
      const pharPath = `/tmp/client-${phpVersion}.phar`
      const containerName = cleanParam(this.connection.container_name)
      if (!containerName) {
        throw new Error('Container is not selected')
      }

      if (this.ssh) {
        await this.ssh.exec(
          buildPosixCommand(await this.getDockerPath(), ['cp', getClient, `${containerName}:${pharPath}`])
        )
      } else {
        await this.runLocalDocker(['cp', getClient, `${containerName}:${pharPath}`], DOCKER_SETUP_TIMEOUT)
      }

      return pharPath
    } catch (error) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  private async runLocalDocker(args: string[], timeout: number): Promise<string> {
    return await new Promise((resolve, reject) => {
      execFile('docker', args, { encoding: 'utf8', shell: false, timeout }, (error, stdout, stderr) => {
        if (error) {
          const message = parseDockerErrorMessage(stderr || error)
          console.error('Docker command failed', { args, message })
          reject(new Error(message))
          return
        }
        resolve(stdout)
      })
    })
  }

  private async runLocalDockerStream(
    args: string[],
    timeoutMs: number,
    onData: (chunk: string) => void
  ): Promise<void> {
    return await new Promise((resolve, reject) => {
      let stderr = ''
      let settled = false
      let timeout: ReturnType<typeof setTimeout> | undefined
      const child = spawn('docker', args, { shell: false, windowsHide: true })
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        const message = parseDockerErrorMessage(stderr || error)
        console.error('Docker stream command failed', { args, message })
        reject(new Error(message))
      }
      timeout = setTimeout(() => {
        child.kill()
        fail(new Error(`Docker command timed out after ${timeoutMs / 1000} seconds`))
      }, timeoutMs)

      child.stdout.on('data', chunk => onData(chunk.toString()))
      child.stderr.on('data', chunk => {
        stderr += chunk.toString()
      })
      child.on('error', fail)
      child.on('close', (code, signal) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        if (code === 0) {
          resolve()
          return
        }
        const message = parseDockerErrorMessage(
          stderr || `Docker exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`
        )
        console.error('Docker stream command failed', { args, message })
        reject(new Error(message))
      })
    })
  }
}

const parseDockerErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const endIndex = error.message.indexOf("See 'docker")
    return endIndex !== -1 ? error.message.slice(0, endIndex).trim() : error.message
  }

  if (typeof error === 'string') {
    const endIndex = error.indexOf("See 'docker")
    return endIndex !== -1 ? error.slice(0, endIndex).trim() : error
  }

  return 'An unknown error occurred'
}
