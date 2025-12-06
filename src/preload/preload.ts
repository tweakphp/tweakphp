import { contextBridge, ipcRenderer } from 'electron'
import os from 'os'

export interface IpcRenderer {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  send: (channel: string, ...args: any[]) => void
  on: (channel: string, callback: (...args: any[]) => void) => void
  removeListener: (channel: string, callback: (...args: any[]) => void) => void
  once: (channel: string, callback: (...args: any[]) => void) => void
}

export interface PlatformInfo {
  getPlatform: () => NodeJS.Platform
  getLspPort: () => Number
  isDev: () => boolean
}

const ipcRendererHandler: IpcRenderer = {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args))
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (_, ...args) => callback(...args))
  },
}

contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererHandler)

contextBridge.exposeInMainWorld('platformInfo', {
  getPlatform: () => os.platform(),
  getLspPort: () => parseInt(process.env.VITE_LSP_WEBSOCKET_PORT || '54331', 10),
  isDev: () => process.env.NODE_ENV === 'development',
})

/**
 * Exposes the `historyApi` to the renderer process.
 */
contextBridge.exposeInMainWorld('historyApi', {
  add: (tabId: number, code: string, cursor: monaco.IPosition) => {
    ipcRenderer.send('code-add', { tabId, code, cursor })
  },
  undo: (tabId: number) => {
    ipcRenderer.send('code-undo', tabId)
  },
  redo: (tabId: number) => {
    ipcRenderer.send('code-redo', tabId)
  },
  onUndoReply: (callback: (data: { code: string; cursor: monaco.IPosition }) => void) => {
    ipcRenderer.on('code-undo.reply', (_event, args) => {
      if (args.data) {
        callback(args.data)
      }
    })
  },
  onRedoReply: (callback: (data: { code: string; cursor: monaco.IPosition }) => void) => {
    ipcRenderer.on('code-redo.reply', (_event, args) => {
      if (args.data) {
        callback(args.data)
      }
    })
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('code-undo.reply')
    ipcRenderer.removeAllListeners('code-redo.reply')
  },
})
