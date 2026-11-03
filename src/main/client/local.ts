import * as fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { ChildProcess, execFile } from 'child_process'
import { ConnectionConfig } from '../../types/local.type'
import { STOP_TIMEOUT_MS } from '../utils/timeouts'
import { buildPosixStopScript, buildWindowsStopScript, clientStopPattern, StopSignal } from '../utils/stop-command'
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

  async stop(pid?: number, signal: StopSignal = 'TERM'): Promise<void> {
    if (!pid) return
    const targetPath = this.connection.path
    const wsl = getWslDetails(targetPath)

    if (process.platform === 'win32' && !wsl.isWsl) {
      // native Windows: php runs below a cmd.exe shell handle, so verify the
      // reported pid via CIM and force-kill its whole tree
      const pattern = clientStopPattern(getLocalPharClient(this.connection))
      const script = buildWindowsStopScript(pid, pattern)
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { encoding: 'utf8', shell: false, timeout: STOP_TIMEOUT_MS, windowsHide: true },
        (error, _stdout, _stderr) => {
          if (error) {
            console.error('Failed to stop the Windows php process', error)
          }
        }
      )
      return
    }

    if (!isWindowsOrWsl(targetPath)) {
      // unix local: the reported pid IS the spawned child, the execution
      // registry handles TERM/KILL escalation on the handle directly
      return
    }

    if (!wsl.isWsl || !wsl.distro) {
      return
    }
    const distro = resolveWslDistro(wsl.distro)
    if (!distro) {
      return
    }
    // identity check + kill run as one command inside the distro namespace
    const pattern = clientStopPattern(getLocalPharClient(this.connection))
    const script = buildPosixStopScript(pid, pattern, signal)
    execFile(
      'wsl',
      ['-d', distro, '-e', 'sh', '-c', script],
      { encoding: 'utf8', shell: false, timeout: STOP_TIMEOUT_MS },
      (error, _stdout, _stderr) => {
        if (error) {
          console.error('Failed to stop the WSL php process', error)
        }
      }
    )
  }

  execute(code: string, loader?: string, projectPath?: string): Promise<string> {
    const targetPath = projectPath || this.connection.path
    const pharPath = getLocalPharClient(this.connection)

    if (isWindowsOrWsl(targetPath)) {
      return executeWindows(this.connection, pharPath, code, loader, targetPath)
    }
    return executeUnix(this.connection, pharPath, code, loader, targetPath)
  }

  executeStreaming(
    code: string,
    loader?: string,
    onEvent?: (event: any) => void,
    onChild?: (child: ChildProcess) => void
  ): Promise<void> {
    const pharPath = getLocalPharClient(this.connection)

    if (isWindowsOrWsl(this.connection.path)) {
      return executeStreamingWindows(this.connection, pharPath, code, loader, onEvent, onChild)
    }
    return executeStreamingUnix(this.connection, pharPath, code, loader, onEvent, onChild)
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
