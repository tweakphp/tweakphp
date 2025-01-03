import { execSync } from 'child_process'
import path from 'path'
import { app, ipcMain } from 'electron'
import { isLinux, isMacOS } from './platform.ts'
import { DockerContainerResponse, PHPInfoResponse } from './types/docker.type.ts'

export const DOCKER_PATH = (() => {
  if (isLinux()) return '/usr/bin/docker'
  if (isMacOS()) return '/usr/local/bin/docker'
  return ''
})()

export const init = async () => {
  ipcMain.on('docker.containers.info', async event => {
    try {
      const containers = getDockerContainers()
      event.reply('docker.containers.reply', containers)
    } catch (error: unknown) {
      event.reply('docker.containers.reply.error', { error })
    }
  })

  ipcMain.on('docker.php-version.info', (event, args) => {
    try {
      const result = checkPHPVersion(args.container_id)
      event.reply('docker.php-version.reply', result)
    } catch (error: unknown) {
      event.reply('docker.php-version.reply.error', { error })
    }
  })

  ipcMain.on('docker.copy-phar.execute', (event, args) => {
    try {
      const versionMatch = args.php_version.match(/^(\d+\.\d+)/)
      const phpVersion = versionMatch ? versionMatch[1] : null

      const result = copyPharClient(phpVersion, args.container_id)

      event.reply('docker.copy-phar.reply', {
        container_id: args.container_id,
        phar_path: result,
      })
    } catch (error: unknown) {
      event.reply('docker.copy-phar.reply.error', { error })
    }
  })
}

export const getDockerContainers = (): DockerContainerResponse[] | null => {
  try {
    const result = execSync(`${DOCKER_PATH} ps --format "{{.ID}}|{{.Names}}|{{.Image}}"`, {
      encoding: 'utf-8',
    }).trim()

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

export const getPhpPath = (containerId: string): string | null => {
  try {
    return execSync(`${DOCKER_PATH} exec ${containerId} which php`).toString().trim()
  } catch (error: unknown) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const copyPharClient = (phpVersion: string | null, containerId: string): string => {
  let getClient: string = app.isPackaged
    ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
    : path.join(__dirname, `../public/client-${phpVersion}.phar`)

  try {
    const pharPath = `/tmp/client-${phpVersion}.phar`
    execSync(`${DOCKER_PATH} cp ${getClient} ${containerId}:'${pharPath}'`).toString().trim()

    return pharPath
  } catch (error) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const checkPHPVersion = (containerId: string): PHPInfoResponse => {
  try {
    const result = execSync(`${DOCKER_PATH} exec ${containerId} php --version`).toString().trim()

    const versionMatch = result.match(/PHP\s(\d+\.\d+\.\d+)/)
    const phpVersion = versionMatch ? versionMatch[1] : null

    return {
      php_path: getPhpPath(containerId) || '',
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
