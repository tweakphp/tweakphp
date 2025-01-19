import { exec } from 'child_process'
import { ConnectionConfig } from '../../types/local.type'
import * as php from '../php'
import * as settings from '../settings'
import { app } from 'electron'
import path from 'path'
import { BaseClient } from './client.base'

export class LocalClient extends BaseClient {
  constructor(public connection: ConnectionConfig) {
    super(connection)
  }

  execute(code: string): Promise<string> {
    return new Promise(resolve => {
      const phpPath = `"${this.connection.php}"`
      const path = `"${this.connection.path}"`
      code = btoa(code.replaceAll('<?php', ''))
      const command = `${phpPath} ${getLocalPharClient()} ${path} execute ${code}`
      exec(command, (_err, stdout) => {
        resolve(stdout)
      })
    })
  }

  async info(): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`"${this.connection.php}" ${getLocalPharClient()} ${this.connection.path} info`, (error, stdout) => {
        if (error) {
          reject(error.message)
          return
        }
        resolve(stdout?.replaceAll('\n', ''))
      })
    })
  }
}

export const getLocalPharClient = (): string => {
  const phpVersion = php.getVersion(settings.getSettings().php)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, `public/client-${phpVersion}.phar`)
  }

  if (process.env.CLIENT_PATH) {
    return process.env.CLIENT_PATH
  }

  return path.join(__dirname, `../public/client-${phpVersion}.phar`)
}
