import { exec, execSync } from 'child_process'
import { ConnectionConfig } from '../../types/docker.type'
import { SSH } from '../utils/ssh'
import { BaseClient } from './client.base'
import { isWindows } from '../system/platform'
import { app } from 'electron'
import path from 'path'
import { base64Encode } from '../utils/base64-encode'

const dockerPathCache: Record<string, string> = {}

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

      const phpPath = `"${phpPathVal}"`
      const path = `"${workingDirVal}"`
      const clientPath = `"${clientPathVal}"`
      const dockerPath = await this.getDockerPath()
      const command = `${dockerPath} exec ${containerName} ${phpPath} ${clientPath} ${path} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`

      if (this.ssh) {
        return await this.ssh.exec(command)
      }

      return await new Promise<string>((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
          if (err) {
            reject(new Error(parseDockerErrorMessage(err.message || stderr || err)))
          } else {
            resolve(stdout)
          }
        })
      })
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

      const phpPath = `"${phpPathVal}"`
      const path = `"${workingDirVal}"`
      const clientPath = `"${clientPathVal}"`
      const dockerPath = await this.getDockerPath()
      const command = `${dockerPath} exec ${containerName} ${phpPath} ${clientPath} ${path} info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`

      if (this.ssh) {
        return await this.ssh.exec(command)
      }

      return execSync(command).toString()
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
      const dockerPath = await this.getDockerPath()

      let result
      const command = `${dockerPath} ps --format "{{.ID}}|{{.Names}}|{{.Image}}"`
      if (this.ssh) {
        result = (await this.ssh.exec(command)).trim()
      } else {
        result = execSync(command).toString().trim()
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
      const dockerPath = await this.getDockerPath()
      const command = `${dockerPath} exec ${containerName} php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`
      let phpVersion
      if (this.ssh) {
        phpVersion = (await this.ssh.exec(command)).trim()
      } else {
        phpVersion = execSync(command).toString().trim()
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

      return execSync('which docker').toString().trim()
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
      const dockerPath = await this.getDockerPath()

      const command = `${dockerPath} exec ${containerName} which php`

      if (this.ssh) {
        return (await this.ssh.exec(command)).trim()
      }

      return execSync(command).toString().trim()
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  private async getClientPath(): Promise<string> {
    const phpVersion = this.connection.php_version || '8.2'
    let getClient
    if (!isWindows()) {
      getClient = app.isPackaged
        ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
        : path.join(__dirname, `../public/client-${phpVersion}.phar`)
    } else {
      getClient = path.join(process.cwd(), `public/client-${phpVersion}.phar`).replace(/\\/g, '/')
    }

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

      const dockerPath = await this.getDockerPath()

      const command = `${dockerPath} cp "${getClient}" ${containerName}:${pharPath}`

      if (this.ssh) {
        await this.ssh.exec(command)
      } else {
        execSync(command)
      }

      return pharPath
    } catch (error) {
      throw new Error(parseDockerErrorMessage(error))
    }
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
