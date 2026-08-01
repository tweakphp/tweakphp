import * as fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { ConnectionConfig } from '../../types/local.type'
import { BaseClient } from './client.base'
import {
  executeWindows,
  executeStreamingWindows,
  infoWindows,
  getPHPVersionWindows,
  getWslDetails,
  getWslDistros,
  resolveWslDistro,
  translateWindowsToWslPath,
  getWslPhpExecutable,
} from './local.windows'
import { executeUnix, executeStreamingUnix, infoUnix, getPHPVersionUnix } from './local.unix'

export { getWslDistros, resolveWslDistro, getWslDetails, translateWindowsToWslPath, getWslPhpExecutable }

const isWindowsOrWsl = (projectPath?: string): boolean => {
  if (process.platform === 'win32') return true
  if (projectPath && getWslDetails(projectPath).isWsl) return true
  return false
}

export class LocalClient extends BaseClient {
  constructor(public connection: ConnectionConfig) {
    super(connection)
  }

  execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    const targetPath = projectPath || this.connection.path
    const pharPath = getLocalPharClient(this.connection)

    if (isWindowsOrWsl(targetPath)) {
      return executeWindows(this.connection, pharPath, code, loader, targetPath)
    }
    return executeUnix(this.connection, pharPath, code, loader, targetPath)
  }

  executeStreaming(code: string, loader?: string, onEvent?: (event: any) => void): Promise<void> {
    const pharPath = getLocalPharClient(this.connection)

    if (isWindowsOrWsl(this.connection.path)) {
      return executeStreamingWindows(this.connection, pharPath, code, loader, onEvent)
    }
    return executeStreamingUnix(this.connection, pharPath, code, loader, onEvent)
  }

  async info(loader?: string): Promise<string> {
    const pharPath = getLocalPharClient(this.connection)

    if (isWindowsOrWsl(this.connection.path)) {
      return infoWindows(this.connection, pharPath, loader)
    }
    return infoUnix(this.connection, pharPath, loader)
  }
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

  return exact
}

export const getPHPVersion = (connection?: ConnectionConfig | string): string | null => {
  const projectPath = typeof connection === 'string' ? '' : (connection?.path ?? '')
  if (isWindowsOrWsl(projectPath)) {
    return getPHPVersionWindows(connection)
  }
  return getPHPVersionUnix(connection)
}
