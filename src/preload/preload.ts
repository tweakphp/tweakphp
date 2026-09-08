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

// Map from user callback → per-channel wrapper, so removeListener can find the right wrapper
const listenerWrappers = new Map<(...args: any[]) => void, Map<string, (...args: any[]) => void>>()

const toCloneable = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => toCloneable(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toCloneable(item)])) as T
  }

  return value
}

const ipcRendererHandler: IpcRenderer = {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args.map(toCloneable))
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args.map(toCloneable))
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, ...args: any[]) => callback(...args)
    if (!listenerWrappers.has(callback)) {
      listenerWrappers.set(callback, new Map())
    }
    listenerWrappers.get(callback)!.set(channel, wrapper)
    ipcRenderer.on(channel, wrapper)
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    const wrapper = listenerWrappers.get(callback)?.get(channel)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      const channelMap = listenerWrappers.get(callback)!
      channelMap.delete(channel)
      if (channelMap.size === 0) listenerWrappers.delete(callback)
    }
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
    ipcRenderer.send('code-history:add', { tabId, code, cursor })
  },
  undo: (tabId: number) => {
    ipcRenderer.send('code-history:undo', tabId)
  },
  redo: (tabId: number) => {
    ipcRenderer.send('code-history:redo', tabId)
  },
  onUndoReply: (callback: (data: { code: string; cursor: monaco.IPosition }) => void) => {
    ipcRenderer.on('code-history:undo:reply', (_event, args) => {
      if (args.data) {
        callback(args.data)
      }
    })
  },
  onRedoReply: (callback: (data: { code: string; cursor: monaco.IPosition }) => void) => {
    ipcRenderer.on('code-history:redo:reply', (_event, args) => {
      if (args.data) {
        callback(args.data)
      }
    })
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('code-history:undo:reply')
    ipcRenderer.removeAllListeners('code-history:redo:reply')
  },
})
