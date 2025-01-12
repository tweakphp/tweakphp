import { app, ipcMain } from 'electron'
import { DockerContainerResponse, PHPInfoResponse } from './types/docker.type.ts'
import * as ssh from './ssh.ts'
import { ConnectionConfig } from '../types/ssh.type.ts'
import path from 'path'

const dockerPathCache: Record<string, string> = {}

export const getDockerPath = async (connection: ConnectionConfig): Promise<string> => {
  if (dockerPathCache[connection.host]) {
    return dockerPathCache[connection.host]
  }

  try {
    const result = await ssh.exec(connection, 'which docker')
    const dockerPath = result.toString().trim()
    dockerPathCache[connection.host] = dockerPath || 'docker'
    return dockerPathCache[connection.host]
  } catch (error) {
    dockerPathCache[connection.host] = 'docker'
    return 'docker'
  }
}

export const init = async () => {
  ipcMain.on('docker.ssh.containers.info', async (event, args) => {
    try {
      const containers = await getDockerContainers(args)
      event.reply('docker.ssh.containers.reply', containers)
    } catch (error: unknown) {
      event.reply('docker.ssh.containers.reply.error', { error })
    }
  })

  ipcMain.on('docker.ssh.php-version.info', async (event, args) => {
    try {
      const result = await checkPHPVersion(args)
      event.reply('docker.ssh.php-version.reply', result)
    } catch (error: unknown) {
      event.reply('docker.ssh.php-version.reply.error', { error })
    }
  })

  ipcMain.on('docker.ssh.copy-phar.execute', async (event, args) => {
    try {
      const versionMatch = args.php_version.match(/^(\d+\.\d+)/)
      const phpVersion = versionMatch ? versionMatch[1] : null

      const result = await copyPharClient(args, phpVersion)

      event.reply('docker.ssh.copy-phar.reply', {
        container_name: args.container_name,
        phar_path: result,
        docker_path: await getDockerPath(args.connection),
      })
    } catch (error: unknown) {
      event.reply('docker.ssh.copy-phar.reply.error', { error })
    }
  })
}

export const getDockerContainers = async (connection: ConnectionConfig): Promise<DockerContainerResponse[]> => {
  try {
    const dockerPath = await getDockerPath(connection)

    const command = `${dockerPath} ps --format "{{.ID}}|{{.Names}}|{{.Image}}"`

    const result = await ssh.exec(connection, command)

    if (result) {
      return result.split('\n').map(line => {
        const [id, name, image] = line.split('|')
        return { id, name, image }
      })
    }

    return []
  } catch (error: unknown) {
    console.error('Error while fetching Docker containers:', error)
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const checkPHPVersion = async (args: {
  connection: ConnectionConfig
  container_name: string
}): Promise<PHPInfoResponse> => {
  try {
    const dockerPath = await getDockerPath(args.connection)

    const command = `${dockerPath} exec ${args.container_name} php --version`

    const result = await ssh.exec(args.connection, command)

    const versionMatch = result.match(/PHP\s(\d+\.\d+\.\d+)/)
    const phpVersion = versionMatch ? versionMatch[1] : null

    return {
      php_path: (await getPHPPath(args)) || '',
      php_version: phpVersion || '',
    }
  } catch (error) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const getPHPPath = async (args: {
  connection: ConnectionConfig
  container_name: string
}): Promise<string | null> => {
  try {
    const dockerPath = await getDockerPath(args.connection)

    const command = `${dockerPath} exec ${args.container_name} which php`

    return await ssh.exec(args.connection, command)
  } catch (error: unknown) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const copyPharClient = async (
  args: { connection: ConnectionConfig; container_name: string },
  phpVersion: string
): Promise<string> => {
  const pharClientLocalPath = app.isPackaged
    ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
    : path.join(__dirname, `../public/client-${phpVersion}.phar`)

  try {
    const pharClientDockerPath = `/tmp/client-${phpVersion}.phar`

    const checkClient = await ssh.exec(args.connection, `[ -e "${pharClientDockerPath}" ] || echo "not_found"`)

    const homePath = (await ssh.exec(args.connection, 'echo $HOME')).trim()
    const pharClientRemotePath = `${homePath}/.tweakphp/client-${phpVersion}.phar`

    if (checkClient.trim() == 'not_found') {
      await ssh.uploadFile(args.connection, pharClientLocalPath, pharClientRemotePath)
    }

    const dockerPath = await getDockerPath(args.connection)

    const command = `${dockerPath} cp ${pharClientRemotePath} ${args.container_name}:'${pharClientDockerPath}'`

    await ssh.exec(args.connection, command)

    return pharClientDockerPath
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
