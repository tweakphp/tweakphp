import { execSync } from 'child_process'
import path from 'path'
import { app, ipcMain } from 'electron'
import { DockerContainerResponse, PHPInfoResponse } from './types/docker.type.ts'
import { isWindows } from './platform.ts'

export const getDockerPath = async () => {
  try {
    return execSync('which docker').toString().trim()
  } catch (error) {
    return 'docker'
  }
}

export const init = async () => {
  ipcMain.on('docker.containers.info', async event => {
    try {
      const containers = await getDockerContainers()

      event.reply('docker.containers.reply', containers)
    } catch (error: unknown) {
      event.reply('docker.containers.reply.error', { error })
    }
  })

  ipcMain.on('docker.php-version.info', async (event, args) => {
    try {
      const result = await checkPHPVersion(args.container_name)

      event.reply('docker.php-version.reply', result)
    } catch (error: unknown) {
      event.reply('docker.php-version.reply.error', { error })
    }
  })

  ipcMain.on('docker.copy-phar.execute', async (event, args) => {
    try {
      const versionMatch = args.php_version.match(/^(\d+\.\d+)/)
      const phpVersion = versionMatch ? versionMatch[1] : null

      const result = await copyPharClient(phpVersion, args.container_name)

      event.reply(args.reply ?? 'docker.copy-phar.reply', {
        container_name: args.container_name,
        phar_path: result,
      })
    } catch (error: unknown) {
      event.reply(args.reply_error ?? 'docker.copy-phar.reply.error', { error })
    }
  })
}

export const getDockerContainers = async (): Promise<DockerContainerResponse[] | null> => {
  try {
    const dockerPath = await getDockerPath()

    const result = execSync(`${dockerPath} ps --format "{{.ID}}|{{.Names}}|{{.Image}}"`, {
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

export const getPHPPath = async (containerId: string): Promise<string | null> => {
  try {
    const dockerPath = await getDockerPath()

    return execSync(`${dockerPath} exec ${containerId} which php`).toString().trim()
  } catch (error: unknown) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const copyPharClient = async (phpVersion: string | null, containerName: string): Promise<string> => {
  let client
  if (!isWindows()) {
    client = app.isPackaged
      ? path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
      : path.join(__dirname, `../public/client-${phpVersion}.phar`)
  } else {
    client = path.join(process.cwd(), `public/client-${phpVersion}.phar`).replace(/\\/g, '/')
  }

  try {
    const pharPath = `/tmp/client-${phpVersion}.phar`

    const dockerPath = await getDockerPath()

    execSync(`${dockerPath} cp "${client}" ${containerName}:${pharPath}`, { stdio: 'inherit' })

    return pharPath
  } catch (error) {
    throw new Error(parseDockerErrorMessage(error))
  }
}

export const checkPHPVersion = async (containerId: string): Promise<PHPInfoResponse> => {
  try {
    const dockerPath = await getDockerPath()

    const result = execSync(`${dockerPath} exec ${containerId} php --version`).toString().trim()

    const versionMatch = result.match(/PHP\s(\d+\.\d+\.\d+)/)
    const phpVersion = versionMatch ? versionMatch[1] : null

    return {
      php_path: (await getPHPPath(containerId)) || '',
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
