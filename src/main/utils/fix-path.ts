import process from 'node:process'
import { shellEnvSync } from 'shell-env'

export function shellPathSync() {
  const { PATH } = shellEnvSync()
  return PATH
}

export const fixPath = () => {
  if (process.platform === 'win32') {
    return
  }

  process.env.PATH =
    shellPathSync() || ['./node_modules/.bin', '/.nodebrew/current/bin', '/usr/local/bin', process.env.PATH].join(':')
}
