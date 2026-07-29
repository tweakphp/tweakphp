import { exec, execSync, spawn } from 'child_process'
import * as fs from 'fs'
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

  execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    return new Promise(resolve => {
      const targetPath = projectPath || this.connection.path
      const wsl = getWslDetails(targetPath)
      let command: string

      if (wsl.isWsl) {
        const distro = wsl.distro!
        const phpExe = getWslPhpExecutable(this.connection.php, distro)
        const pharPathWin = getLocalPharClient(this.connection)
        const pharPathWsl = translateWindowsToWslPath(pharPathWin, distro)
        const projectPathWsl = translateWindowsToWslPath(targetPath, distro)

        command = `wsl -d "${distro}" ${phpExe} "${pharPathWsl}" "${projectPathWsl}" execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      } else {
        const phpPath = `"${this.connection.php}"`
        const path = `"${targetPath}"`
        command = `${phpPath} "${getLocalPharClient(this.connection)}" ${path} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      }
      exec(command, (_err, stdout) => {
        resolve(stdout)
      })
    })
  }

  executeStreaming(code: string, loader?: string, onEvent?: (event: any) => void): Promise<void> {
    return new Promise(resolve => {
      const phpPath = this.connection.php
      const targetPath = this.connection.path
      const pharClient = getLocalPharClient()

      const args = [pharClient, targetPath, 'execute-stream', base64Encode(code)]
      if (loader) {
        args.push(`--loader=${base64Encode(loader)}`)
      }

      const child = spawn(phpPath, args, { windowsHide: true })

      let buffer = ''
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('TWEAKPHP_STREAM:')) {
            const rawJson = trimmed.substring('TWEAKPHP_STREAM:'.length)
            try {
              const eventData = JSON.parse(rawJson)
              if (onEvent) {
                onEvent(eventData)
              }
            } catch (e) {
              console.error('Failed to parse stream event:', e, rawJson)
            }
          } else if (trimmed.startsWith('TWEAKPHP_ERROR:')) {
            const errorJson = trimmed.substring('TWEAKPHP_ERROR:'.length)
            let parsed: any = null
            try {
              parsed = JSON.parse(errorJson)
            } catch (e) {
              parsed = errorJson
            }
            if (onEvent) {
              onEvent({ type: 'error', error: parsed })
            }
          }
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim()
        if (text && onEvent) {
          onEvent({ type: 'output', index: 0, data: text })
        }
      })

      child.on('close', () => {
        if (buffer.trim().startsWith('TWEAKPHP_STREAM:')) {
          try {
            const eventData = JSON.parse(buffer.trim().substring('TWEAKPHP_STREAM:'.length))
            if (onEvent) {
              onEvent(eventData)
            }
          } catch (e) {}
        }
        resolve()
      })

      child.on('error', err => {
        if (onEvent) {
          onEvent({ type: 'error', error: { message: err.message } })
        }
        resolve()
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
  if (process.env.CLIENT_PATH) {
    return process.env.CLIENT_PATH
  }

  const phpVersion = getPHPVersion(connection)
  const baseDir = app.isPackaged ? path.join(process.resourcesPath, 'public') : path.join(__dirname, '../public')
  const exact = path.join(baseDir, `client-${phpVersion}.phar`)

  if (fs.existsSync(exact)) {
    return exact
  }

  // Fall back to the highest available version
  try {
    if (fs.existsSync(baseDir)) {
      const available = fs
        .readdirSync(baseDir)
        .filter(f => f.match(/^client-[\d.]+\.phar$/))
        .sort()
        .reverse()

      if (available.length > 0) {
        return path.join(baseDir, available[0])
      }
    }
  } catch (e) {}

  return exact // let it fail with a clear error
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
