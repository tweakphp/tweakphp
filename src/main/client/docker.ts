import { exec, execSync } from 'child_process'
import { ConnectionConfig } from '../../types/docker.type'
import { SSH } from '../utils/ssh'
import { BaseClient } from './client.base'
import { isWindows } from '../system/platform'
import { app } from 'electron'
import path from 'path'
import { base64Encode } from '../utils/base64-encode'

const dockerPathCache: Record<string, string> = {}

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
    if (this.connection.container_name) {
      this.connection.php_version = await this.getPHPVersion()
      this.connection.php_path = await this.getPHPPath()
      this.connection.client_path = await this.getClientPath()
    }
  }

  execute(code: string, loader?: string): Promise<string> {
    return new Promise(async resolve => {
      let result = ''
      const phpPath = `"${this.connection.php_path}"`
      const path = `"${this.connection.working_directory}"`
      const clientPath = `"${this.connection.client_path}"`
      const dockerPath = await this.getDockerPath()
      const command = `${dockerPath} exec ${this.connection.container_name} ${phpPath} ${clientPath} ${path} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`

      if (this.ssh) {
        result = await this.ssh.exec(command)
        resolve(result)
        return
      }

      exec(command, (_err, stdout) => {
        resolve(stdout)
      })
    })
  }

  async info(loader?: string): Promise<string> {
    return new Promise(async resolve => {
      let result = ''
      const phpPath = `"${this.connection.php_path}"`
      const path = `"${this.connection.working_directory}"`
      const clientPath = `"${this.connection.client_path}"`
      const dockerPath = await this.getDockerPath()
      const command = `${dockerPath} exec ${this.connection.container_name} ${phpPath} ${clientPath} ${path} info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`

      if (this.ssh) {
        result = await this.ssh.exec(command)
        resolve(result)
        return
      }

      result = execSync(command).toString()
      resolve(result)
    })
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
    if (!this.connection.container_name) {
      throw new Error('Container is not selected')
    }
    try {
      const dockerPath = await this.getDockerPath()
      const command = `${dockerPath} exec ${this.connection.container_name} php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`
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
      const dockerPath = await this.getDockerPath()

      const command = `${dockerPath} exec ${this.connection.container_name} which php`

      if (this.ssh) {
        return (await this.ssh.exec(command)).trim()
      }

      return execSync(command).toString().trim()
    } catch (error: unknown) {
      throw new Error(parseDockerErrorMessage(error))
    }
  }

  private async getClientPath(): Promise<string> {
    let getClient
    if (!isWindows()) {
      getClient = app.isPackaged
        ? path.join(process.resourcesPath, `public/client-${this.connection.php_version}.phar`)
        : path.join(__dirname, `../public/client-${this.connection.php_version}.phar`)
    } else {
      getClient = path.join(process.cwd(), `public/client-${this.connection.php_version}.phar`).replace(/\\/g, '/')
    }

    if (this.ssh) {
      const tmpClientPath = `/tmp/client-${this.connection.php_version}.phar`
      await this.ssh.uploadFile(getClient, tmpClientPath)
      getClient = tmpClientPath
    }

    try {
      const pharPath = `/tmp/client-${this.connection.php_version}.phar`

      const dockerPath = await this.getDockerPath()

      const command = `${dockerPath} cp ${getClient} ${this.connection.container_name}:'${pharPath}'`

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

  return 'An unknown error occurred'
}
