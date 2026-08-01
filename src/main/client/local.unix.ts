import { execFile, execFileSync, spawn } from 'child_process'
import { ConnectionConfig } from '../../types/local.type'
import * as settings from '../settings'
import { base64Encode } from '../utils/base64-encode'

export const executeUnix = (
  connection: ConnectionConfig,
  pharPath: string,
  code: string,
  loader?: string,
  projectPath?: string
): Promise<string> => {
  return new Promise(resolve => {
    const targetPath = projectPath || connection.path
    const phpPath = connection.php || 'php'
    const args = [pharPath, targetPath, 'execute', base64Encode(code)]
    if (loader) {
      args.push(`--loader=${base64Encode(loader)}`)
    }

    execFile(phpPath, args, { shell: false }, (_err, stdout) => {
      resolve(stdout || '')
    })
  })
}

export const executeStreamingUnix = (
  connection: ConnectionConfig,
  pharPath: string,
  code: string,
  loader?: string,
  onEvent?: (event: any) => void
): Promise<void> => {
  return new Promise(resolve => {
    const targetPath = connection.path
    const phpPath = connection.php || 'php'
    const args = [pharPath, targetPath, 'execute-stream', base64Encode(code)]
    if (loader) {
      args.push(`--loader=${base64Encode(loader)}`)
    }

    const child = spawn(phpPath, args, {
      shell: false,
    })

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

export const infoUnix = (connection: ConnectionConfig, pharPath: string, loader?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const phpPath = connection.php || 'php'
    const args = [pharPath, connection.path, 'info']
    if (loader) {
      args.push(`--loader=${base64Encode(loader)}`)
    }

    execFile(phpPath, args, { shell: false }, (error, stdout) => {
      if (error) {
        reject(error.message)
        return
      }
      resolve(stdout?.replaceAll('\n', '') || '')
    })
  })
}

export const getPHPVersionUnix = (connection?: ConnectionConfig | string): string | null => {
  try {
    let phpPath = settings.getSettings().php

    if (connection) {
      if (typeof connection === 'string') {
        phpPath = connection
      } else {
        phpPath = connection.php ?? phpPath
      }
    }

    const phpExe = phpPath || 'php'
    const output = execFileSync(phpExe, ['-v'], {
      encoding: 'utf8',
      shell: false,
    })
    const match = output.match(/PHP\s+([0-9]+\.[0-9]+)/i)
    return match ? match[1] : null
  } catch (error: any) {
    console.error('Error executing PHP command:', error.message)
    console.error('Stack:', error.stack)
    return null
  }
}
