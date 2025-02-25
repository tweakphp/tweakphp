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
      const phpPath = `"${this.connection.php}"`
      const path = `"${this.connection.path}"`
      const command = `${phpPath} "${getLocalPharClient()}" ${path} execute ${base64Encode(code)} ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`
      exec(command, (_err, stdout) => {
        resolve(stdout)
      })
    })
  }

  async info(loader?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(
        `"${this.connection.php}" "${getLocalPharClient()}" "${this.connection.path}" info ${loader ? `--loader=${base64Encode(loader || '')}` : ''}`,
        (error, stdout) => {
          if (error) {
            reject(error.message)
            return
          }
          resolve(stdout?.replaceAll('\n', ''))
        }
      )
    })
  }
}

export const getLocalPharClient = (): string => {
  const phpVersion = getPHPVersion(settings.getSettings().php)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
  }

  if (process.env.CLIENT_PATH) {
    return process.env.CLIENT_PATH
  }

  return path.join(__dirname, `../public/client-${phpVersion}.phar`)
}

export const getPHPVersion = (path: string | undefined) => {
  try {
    const command = `"${path}" -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`
    const output = execSync(command, { encoding: 'utf8' })
    return output.trim()
  } catch (error: any) {
    console.error('Error executing PHP command:', error.message)
    console.error('Stack:', error.stack)
    return null
  }
}
