import { contextBridge, ipcRenderer } from 'electron'
import { LSP_WEBSOCKET_DEFAULT_PORT } from '../shared/constants'

import type * as monaco from 'monaco-editor'

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

// Allowed IPC channels per method: the renderer can only talk to the main
// process through these explicit whitelists (mitigates XSS → IPC → RCE chains)
const invokeAllowList = new Set<string>([
  'app:init',
  'ai:get-completion',
  'lsp:restart',
  'settings:save',
  'settings:detect-php',
  'mcp:get-status',
  'mcp:start',
  'mcp:stop',
  'mcp:settings-changed',
  'storage:app:get',
  'storage:app:set',
  'storage:app:remove',
  'storage:migration:check',
  'storage:migration:import',
  'storage:connections:list',
  'storage:connections:save',
  'storage:connections:delete',
  'storage:loaders:list',
  'storage:loaders:save',
  'storage:loaders:delete',
  'storage:tabs:list',
  'storage:tabs:save-all',
])

const sendAllowList = new Set<string>([
  'client:connect',
  'client:execute',
  'client:action',
  'client:info',
  'source:open',
  'source:open-path',
  'link:open',
  'update:check',
  'update:download',
  'update:test-progress',
  'update:cancel',
])

const onAllowList = new Set<string>([
  'update:available',
  'update:not-available',
  'update:checking',
  'update:download-progress',
  'update:downloaded',
  'update:cancelled',
  'source:open:reply',
  'client:connect:reply',
  'client:execute:reply',
  'client:execute:stream',
  'client:action:reply',
  'client:info:reply',
  'statusbar:progress',
  'settings:php-located',
  'mcp:status-update',
  'ssh:disconnect',
])

const assertAllowedChannel = (method: string, allowList: Set<string>, channel: string): void => {
  if (!allowList.has(channel)) {
    throw new Error(`Blocked ipcRenderer.${method}() on channel "${channel}"`)
  }
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
    assertAllowedChannel('invoke', invokeAllowList, channel)
    return ipcRenderer.invoke(channel, ...args.map(toCloneable))
  },
  send: (channel: string, ...args: any[]) => {
    assertAllowedChannel('send', sendAllowList, channel)
    ipcRenderer.send(channel, ...args.map(toCloneable))
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    assertAllowedChannel('on', onAllowList, channel)
    const wrapper = (_: Electron.IpcRendererEvent, ...args: any[]) => callback(...args)
    if (!listenerWrappers.has(callback)) {
      listenerWrappers.set(callback, new Map())
    }
    listenerWrappers.get(callback)!.set(channel, wrapper)
    ipcRenderer.on(channel, wrapper)
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    assertAllowedChannel('removeListener', onAllowList, channel)
    const wrapper = listenerWrappers.get(callback)?.get(channel)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      const channelMap = listenerWrappers.get(callback)!
      channelMap.delete(channel)
      if (channelMap.size === 0) listenerWrappers.delete(callback)
    }
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    assertAllowedChannel('once', onAllowList, channel)
    ipcRenderer.once(channel, (_, ...args) => callback(...args))
  },
}

contextBridge.exposeInMainWorld('ipcRenderer', ipcRendererHandler)

contextBridge.exposeInMainWorld('platformInfo', {
  getPlatform: () => process.platform,
  getLspPort: () => parseInt(process.env.VITE_LSP_WEBSOCKET_PORT || String(LSP_WEBSOCKET_DEFAULT_PORT), 10),
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
