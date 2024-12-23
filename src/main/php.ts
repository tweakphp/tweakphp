import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

let cachedPhpPath: string | null = null

import { IpcMainEvent } from 'electron'

export const path = async (event: IpcMainEvent) => {
  event.reply('php.path.reply', getPHPPath())
}

export const getPHPPath = () => {
  if (cachedPhpPath) {
    return cachedPhpPath
  }

  try {
    const userHome = homedir()

    const methods = [
      () => {
        const herdPath = join(userHome, 'Library/Application Support/Herd/bin/php')
        return execSync(`[ -x "${herdPath}" ] && echo "${herdPath}"`, { encoding: 'utf8' })
      },
      () => execSync('which php', { encoding: 'utf8' }), 
      () => execSync('/usr/bin/which php', { encoding: 'utf8' }),
      () => execSync('command -v php', { encoding: 'utf8' }),

      () => execSync('[ -x /usr/local/bin/php ] && echo /usr/local/bin/php', { encoding: 'utf8' }),
      () => execSync('[ -x /opt/homebrew/bin/php ] && echo /opt/homebrew/bin/php', { encoding: 'utf8' })
    ]

    for (const method of methods) {
      try {
        const result = method().toString().trim()
        if (result) {
          
          const version = getVersion(result)
          if (version) {
            cachedPhpPath = result
            return result
          }
        }
      } catch {
        continue 
      }
    }

    throw new Error('PHP not found in system')
  } catch (error) {
    console.error(`Error retrieving PHP path: ${error}`)
    return ''
  }
}

export const getVersion = (path: string | undefined) => {
  try {
    const command = `"${path}" -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . PHP_EOL;"`
    const output = execSync(command, { encoding: 'utf8' })
    return output.trim() // Clean up extra whitespace or newlines
  } catch (error: any) {
    console.error('Error executing PHP command:', error.message)
    console.error('Stack:', error.stack)
    return null
  }
}
