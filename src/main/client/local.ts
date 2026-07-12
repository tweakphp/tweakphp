import { exec, execSync } from 'child_process'
import { ConnectionConfig } from '../../types/local.type'
import * as settings from '../settings'
import { app } from 'electron'
import path from 'path'
import { BaseClient } from './client.base'
import { base64Encode } from '../utils/base64-encode'

export class LocalClient extends BaseClient {
  constructor(public connection: ConnectionConfig) {
    super(connection)
  }

  execute(code: string, loader?: string): Promise<string> {
    return new Promise(resolve => {
      const wsl = getWslDetails(this.connection.path)
      let command: string

      if (wsl.isWsl) {
        const distro = wsl.distro!
        const phpExe = getWslPhpExecutable(this.connection.php, distro)
        const pharPathWin = getLocalPharClient(this.connection)
        const pharPathWsl = translateWindowsToWslPath(pharPathWin, distro)
        const projectPathWsl = translateWindowsToWslPath(this.connection.path, distro)

        command = `wsl -d "${distro}" ${phpExe} "${pharPathWsl}" "${projectPathWsl}" execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      } else {
        const phpPath = `"${this.connection.php}"`
        const path = `"${this.connection.path}"`
        command = `${phpPath} "${getLocalPharClient(this.connection)}" ${path} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      }

      exec(command, (_err, stdout) => {
        resolve(stdout)
      })
    })
  }

  async info(loader?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const wsl = getWslDetails(this.connection.path)
      let command: string

      if (wsl.isWsl) {
        const distro = wsl.distro!
        const phpExe = getWslPhpExecutable(this.connection.php, distro)
        const pharPathWin = getLocalPharClient(this.connection)
        const pharPathWsl = translateWindowsToWslPath(pharPathWin, distro)
        const projectPathWsl = translateWindowsToWslPath(this.connection.path, distro)

        command = `wsl -d "${distro}" ${phpExe} "${pharPathWsl}" "${projectPathWsl}" info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      } else {
        command = `"${this.connection.php}" "${getLocalPharClient(this.connection)}" "${this.connection.path}" info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      }

      exec(command, (error, stdout) => {
        if (error) {
          reject(error.message)
          return
        }
        resolve(stdout?.replaceAll('\n', ''))
      })
    })
  }
}

export const getWslDetails = (projectPath: string) => {
  const wslRegex = /^\\\\(wsl\.localhost|wsl\$)\\([^\\]+)/i
  const normalizedPath = projectPath.replace(/\//g, '\\')
  const match = normalizedPath.match(wslRegex)
  if (match) {
    return {
      isWsl: true,
      distro: match[2],
    }
  }
  return { isWsl: false, distro: null }
}

export const translateWindowsToWslPath = (winPath: string, distro: string): string => {
  let normalized = winPath.replace(/\//g, '\\')

  const escapedDistro = distro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wslRegex = new RegExp(`^\\\\\\\\(wsl\\.localhost|wsl\\$)\\\\${escapedDistro}`, 'i')
  if (wslRegex.test(normalized)) {
    let relativePath = normalized.replace(wslRegex, '')
    relativePath = relativePath.replace(/\\/g, '/')
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath
    }
    return relativePath
  }

  const driveMatch = normalized.match(/^([a-zA-Z]):(.*)/)
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase()
    let rest = driveMatch[2].replace(/\\/g, '/')
    if (!rest.startsWith('/')) {
      rest = '/' + rest
    }
    return `/mnt/${drive}${rest}`
  }

  return winPath.replace(/\\/g, '/')
}

export const getWslPhpExecutable = (phpPath: string | undefined, projectDistro?: string): string => {
  if (!phpPath) {
    return 'php'
  }
  const wsl = getWslDetails(phpPath)
  if (wsl.isWsl) {
    let targetPath = phpPath
    if (projectDistro && wsl.distro !== projectDistro) {
      const normalized = phpPath.replace(/\//g, '\\')
      const parts = normalized.split('\\')
      if (parts[3]) {
        parts[3] = projectDistro
        targetPath = parts.join('\\')
      }
    }
    return translateWindowsToWslPath(targetPath, projectDistro || wsl.distro!)
  }
  if (phpPath.includes(':\\') || phpPath.toLowerCase().endsWith('.exe') || phpPath.startsWith('\\\\')) {
    return 'php'
  }
  return phpPath
}

export const getLocalPharClient = (connection?: ConnectionConfig): string => {
  const phpVersion = getPHPVersion(connection)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
  }

  if (process.env.CLIENT_PATH) {
    return process.env.CLIENT_PATH
  }

  return path.join(__dirname, `../public/client-${phpVersion}.phar`)
}

export const getPHPVersion = (connection?: ConnectionConfig | string) => {
  try {
    let phpPath = settings.getSettings().php
    let projectPath = ''

    if (connection) {
      if (typeof connection === 'string') {
        phpPath = connection
      } else {
        phpPath = connection.php ?? phpPath
        projectPath = connection.path ?? ''
      }
    }

    const wsl = getWslDetails(projectPath)
    let command: string
    if (wsl.isWsl) {
      const phpExe = getWslPhpExecutable(phpPath, wsl.distro!)
      command = `wsl -d "${wsl.distro}" ${phpExe} -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`
    } else {
      command = `"${phpPath}" -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`
    }
    const output = execSync(command, { encoding: 'utf8' })
    return output.trim()
  } catch (error: any) {
    console.error('Error executing PHP command:', error.message)
    console.error('Stack:', error.stack)
    return null
  }
}
