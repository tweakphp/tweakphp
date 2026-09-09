import { ipcMain, shell } from 'electron'

const ALLOWED_LINK_PROTOCOLS = new Set(['https:', 'http:'])

const isAllowedLink = (url: string): boolean => {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

export const init = async () => {
  ipcMain.on('link:open', (_event: any, url: string) => {
    if (typeof url !== 'string' || !isAllowedLink(url)) return
    shell.openExternal(url)
  })
}
