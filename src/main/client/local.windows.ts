import { execFile, execFileSync, execSync, spawn } from 'child_process'
import { ConnectionConfig } from '../../types/local.type'
import * as settings from '../settings'
import { base64Encode } from '../utils/base64-encode'

export const getWslDistros = (): string[] => {
  try {
    const out = execSync('wsl -l -q', { encoding: 'utf16le', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 })
    let distrosStr = out.toString()
    if (distrosStr.includes('\u0000')) {
      distrosStr = distrosStr.replace(/\u0000/g, '')
    }
    return distrosStr
      .split(/\r?\n/)
      .map(d => d.trim())
      .filter(Boolean)
      .filter(d => !d.toLowerCase().includes('docker'))
  } catch (e) {
    try {
      const out = execSync('wsl -l -q', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 })
      return out
        .replace(/\u0000/g, '')
        .split(/\r?\n/)
        .map(d => d.trim())
        .filter(Boolean)
        .filter(d => !d.toLowerCase().includes('docker'))
    } catch (err) {
      return []
    }
  }
}

export const resolveWslDistro = (requestedDistro?: string | null): string | null => {
  if (!requestedDistro) {
    const distros = getWslDistros()
    return distros[0] || null
  }

  const cleanRequested = requestedDistro.trim()
  if (!cleanRequested) {
    const distros = getWslDistros()
    return distros[0] || null
  }

  const distros = getWslDistros()
  if (distros.length === 0) {
    return cleanRequested
  }

  // 1. Exact match
  const exact = distros.find(d => d === cleanRequested)
  if (exact) return exact

  // 2. Case-insensitive match
  const caseInsensitive = distros.find(d => d.toLowerCase() === cleanRequested.toLowerCase())
  if (caseInsensitive) return caseInsensitive

  // 3. Prefix match
  const prefixMatch = distros.find(
    d => d.toLowerCase().startsWith(cleanRequested.toLowerCase()) || cleanRequested.toLowerCase().startsWith(d.toLowerCase())
  )
  if (prefixMatch) return prefixMatch

  // If no match found in distros, return cleanRequested
  return cleanRequested
}

export const getWslDetails = (projectPath: string) => {
  if (!projectPath) return { isWsl: false, distro: null }

  const normalizedPath = projectPath.replace(/\//g, '\\')
  const wslRegex = /^\\\\(wsl\.localhost|wsl\$)\\([^\\]+)/i
  const match = normalizedPath.match(wslRegex)
  if (match) {
    return {
      isWsl: true,
      distro: match[2],
    }
  }

  const altRegex = /^[/\\](wsl\.localhost|wsl\$)[/\\]([^/\\]+)/i
  const altMatch = projectPath.match(altRegex)
  if (altMatch) {
    return {
      isWsl: true,
      distro: altMatch[2],
    }
  }

  const parts = projectPath.split(/[/\\]/).filter(Boolean)
  if (parts.length > 1) {
    const distros = getWslDistros()
    const found = distros.find(d => d.toLowerCase() === parts[0].toLowerCase())
    if (found) {
      return {
        isWsl: true,
        distro: found,
      }
    }
  }

  return { isWsl: false, distro: null }
}

export const translateWindowsToWslPath = (winPath: string, distro: string): string => {
  let normalized = winPath.replace(/\//g, '\\')

  const genericWslRegex = /^\\\\(wsl\.localhost|wsl\$)\\[^\\]+/i
  if (genericWslRegex.test(normalized)) {
    let relativePath = normalized.replace(genericWslRegex, '')
    relativePath = relativePath.replace(/\\/g, '/')
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath
    }
    return relativePath
  }

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

  // Handle paths starting with /<distro>/ or \<distro>\ (e.g. /Ubuntu/home/david/...)
  const distroPrefixRegex = new RegExp(`^[\\\\\\/]${escapedDistro}`, 'i')
  if (distroPrefixRegex.test(winPath)) {
    let relativePath = winPath.replace(distroPrefixRegex, '')
    relativePath = relativePath.replace(/\\/g, '/')
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath
    }
    return relativePath
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

export const executeWindows = (
  connection: ConnectionConfig,
  pharPath: string,
  code: string,
  loader?: string,
  projectPath?: string
): Promise<string> => {
  return new Promise(resolve => {
    const targetPath = projectPath || connection.path
    const wsl = getWslDetails(targetPath)

    if (wsl.isWsl) {
      const distro = resolveWslDistro(wsl.distro!)
      if (distro) {
        const phpExe = getWslPhpExecutable(connection.php, distro)
        const pharPathWsl = translateWindowsToWslPath(pharPath, distro)
        const projectPathWsl = translateWindowsToWslPath(targetPath, distro)

        const args = ['-d', distro, phpExe, pharPathWsl, projectPathWsl, 'execute', base64Encode(code)]
        if (loader) {
          args.push(`--loader=${base64Encode(loader)}`)
        }

        execFile('wsl', args, { shell: false }, (_err, stdout) => {
          resolve(stdout || '')
        })
        return
      }
    }

    const phpPath = connection.php || 'php'
    const args = [pharPath, targetPath, 'execute', base64Encode(code)]
    if (loader) {
      args.push(`--loader=${base64Encode(loader)}`)
    }

    execFile(phpPath, args, { shell: process.platform === 'win32' }, (_err, stdout) => {
      resolve(stdout || '')
    })
  })
}

export const executeStreamingWindows = (
  connection: ConnectionConfig,
  pharPath: string,
  code: string,
  loader?: string,
  onEvent?: (event: any) => void
): Promise<void> => {
  return new Promise(resolve => {
    const targetPath = connection.path
    const wsl = getWslDetails(targetPath)

    let phpPath = connection.php
    let args: string[] = []
    let useShell = process.platform === 'win32'

    if (wsl.isWsl) {
      const distro = resolveWslDistro(wsl.distro!)
      if (distro) {
        const phpExe = getWslPhpExecutable(connection.php, distro)
        const pharPathWsl = translateWindowsToWslPath(pharPath, distro)
        const projectPathWsl = translateWindowsToWslPath(targetPath, distro)

        phpPath = 'wsl'
        args = ['-d', distro, phpExe, pharPathWsl, projectPathWsl, 'execute-stream', base64Encode(code)]
        useShell = false
      } else {
        args = [pharPath, targetPath, 'execute-stream', base64Encode(code)]
      }
    } else {
      args = [pharPath, targetPath, 'execute-stream', base64Encode(code)]
    }

    if (loader) {
      args.push(`--loader=${base64Encode(loader)}`)
    }

    const child = spawn(phpPath || 'php', args, {
      windowsHide: true,
      shell: useShell,
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
        } catch (e) { }
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

export const infoWindows = (
  connection: ConnectionConfig,
  pharPath: string,
  loader?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const wsl = getWslDetails(connection.path)

    if (wsl.isWsl) {
      const distro = resolveWslDistro(wsl.distro!)
      if (distro) {
        const phpExe = getWslPhpExecutable(connection.php, distro)
        const pharPathWsl = translateWindowsToWslPath(pharPath, distro)
        const projectPathWsl = translateWindowsToWslPath(connection.path, distro)

        const args = ['-d', distro, phpExe, pharPathWsl, projectPathWsl, 'info']
        if (loader) {
          args.push(`--loader=${base64Encode(loader)}`)
        }

        execFile('wsl', args, { shell: false }, (error, stdout) => {
          if (error) {
            reject(error.message)
            return
          }
          resolve(stdout?.replaceAll('\n', '') || '')
        })
        return
      }
    }

    const phpPath = connection.php || 'php'
    const args = [pharPath, connection.path, 'info']
    if (loader) {
      args.push(`--loader=${base64Encode(loader)}`)
    }

    execFile(phpPath, args, { shell: process.platform === 'win32' }, (error, stdout) => {
      if (error) {
        reject(error.message)
        return
      }
      resolve(stdout?.replaceAll('\n', '') || '')
    })
  })
}

export const getPHPVersionWindows = (connection?: ConnectionConfig | string): string | null => {
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
    let output: string

    if (wsl.isWsl) {
      const distro = resolveWslDistro(wsl.distro!)
      if (distro) {
        const phpExe = getWslPhpExecutable(phpPath, distro)
        output = execFileSync('wsl', ['-d', distro, phpExe, '-v'], {
          encoding: 'utf8',
          shell: false,
        })
        const match = output.match(/PHP\s+([0-9]+\.[0-9]+)/i)
        return match ? match[1] : null
      }
    }

    const phpExe = phpPath || 'php'
    output = execFileSync(phpExe, ['-v'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    const match = output.match(/PHP\s+([0-9]+\.[0-9]+)/i)
    return match ? match[1] : null
  } catch (error: any) {
    console.error('Error executing PHP command:', error.message)
    console.error('Stack:', error.stack)
    return null
  }
}
