import { exec, execSync, spawn } from 'child_process'
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
