import { execSync } from 'child_process'
import path from 'path'
import { app, ipcMain } from 'electron'
import { DockerContainerResponse, PHPInfoResponse } from '../types/docker.type.ts'
import { ConnectionConfig } from '../types/ssh.type.ts'
import * as ssh from './ssh.ts'
import { isWindows } from './platform.ts'

const dockerPathCache: Record<string, string> = {}

export const getDockerPath = async (connection?: ConnectionConfig) => {
  try {
    if (connection) {
      if (dockerPathCache[connection.host]) {
        return dockerPathCache[connection.host]
      }

      const result = await ssh.exec(connection, 'which docker')
      const dockerPath = result.toString().trim()
      dockerPathCache[connection.host] = dockerPath || 'docker'
      return dockerPathCache[connection.host]
    }

    return execSync('which docker').toString().trim()
  } catch (error) {
    if (connection) {
      dockerPathCache[connection.host] = 'docker'
    }
    return 'docker'
  }
}

export const init = async () => {
  ipcMain.on('docker.containers.info', async (event: Electron.IpcMainEvent, connection?: ConnectionConfig) => {
    try {
      const containers = await getDockerContainers(connection)

      event.reply('docker.containers.reply', containers)
    } catch (error: unknown) {
      event.reply('docker.containers.reply.error', { error })
    }
  })

  ipcMain.on(
    'docker.php-version.info',
    async (event: Electron.IpcMainEvent, args: any, connection?: ConnectionConfig) => {
      try {
        const result = await checkPHPVersion(args.container_name, connection)

        event.reply('docker.php-version.reply', result)
      } catch (error: unknown) {
        event.reply('docker.php-version.reply.error', { error })
      }
    }
  )

  ipcMain.on(
    'docker.copy-phar.execute',
    async (event: Electron.IpcMainEvent, args: any, connection?: ConnectionConfig) => {
      try {
        const versionMatch = args.php_version.match(/^(\d+\.\d+)/)
        const phpVersion = versionMatch ? versionMatch[1] : null

        const result = await copyPharClient(phpVersion, args.container_name, connection)

        event.reply(args.reply ?? 'docker.copy-phar.reply', {
          container_name: args.container_name,
          phar_path: result,
        })
      } catch (error: unknown) {
        event.reply(args.reply_error ?? 'docker.copy-phar.reply.error', { error })
      }
    }
  )
}

export const getDockerContainers = async (connection?: ConnectionConfig): Promise<DockerContainerResponse[] | null> => {
  try {
    const dockerPath = await getDockerPath(connection)

    let result
    const command = `${dockerPath} ps --format "{{.ID}}|{{.Names}}|{{.Image}}"`
    if (connection) {
      result = (await ssh.exec(connection, command)).trim()
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

export const getPHPPath = async (containerId: string, connection?: ConnectionConfig): Promise<string | null> => {
  try {
    const dockerPath = await getDockerPath(connection)

    const command = `${dockerPath} exec ${containerId} which php`

    if (connection) {
      return (await ssh.exec(connection, command)).trim()
    }

    return execSync(command).toString().trim()
  } catch (error: unknown) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const copyPharClient = async (
  phpVersion: string | null,
  containerName: string,
  connection?: ConnectionConfig
): Promise<string> => {
  let getClient
  if (!isWindows()) {
    getClient = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)
  } else {
    getClient = path.join(process.cwd(), `public/client-${phpVersion}.phar`).replace(/\\/g, '/')
  }

  if (connection) {
    const tmpClientPath = `/tmp/client-${phpVersion}.phar`
    await ssh.uploadFile(connection, getClient, tmpClientPath)
    getClient = tmpClientPath
  }

  try {
    const pharPath = `/tmp/client-${phpVersion}.phar`

    const dockerPath = await getDockerPath(connection)

    const command = `${dockerPath} cp ${getClient} ${containerName}:'${pharPath}'`

    if (connection) {
      await ssh.exec(connection, command)
    } else {
      execSync(command)
    }

    return pharPath
  } catch (error) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const checkPHPVersion = async (
  containerName: string,
  connection?: ConnectionConfig
): Promise<PHPInfoResponse> => {
  try {
    const dockerPath = await getDockerPath(connection)

    const command = `${dockerPath} exec ${containerName} php --version`

    let result
    if (connection) {
      result = (await ssh.exec(connection, command)).trim()
    } else {
      result = execSync(command).toString().trim()
    }

    const versionMatch = result.match(/PHP\s(\d+\.\d+\.\d+)/)
    const phpVersion = versionMatch ? versionMatch[1] : null

    return {
      php_path: (await getPHPPath(containerName, connection)) || '',
      php_version: phpVersion || '',
    }
  } catch (error) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

const parseDockerErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const endIndex = error.message.indexOf("See 'docker")
    return endIndex !== -1 ? error.message.slice(0, endIndex).trim() : error.message
  }

  return 'An unknown error occurred'
}
