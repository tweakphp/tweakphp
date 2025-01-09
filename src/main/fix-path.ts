import process from 'node:process'
import { shellPathSync } from 'shell-path'

export const fixPath = () => {
  if (process.platform === 'win32') {
    return
  }

  process.env.PATH =
    shellPathSync() || ['./node_modules/.bin', '/.nodebrew/current/bin', '/usr/local/bin', process.env.PATH].join(':')
}
