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
  getLspPort: () => number
  isDev: () => boolean
}

// Allowed IPC channels per method: the renderer can only talk to the main
// process through these explicit whitelists (mitigates XSS → IPC → RCE chains)
const invokeAllowList = new Set<string>([
  'app:init',
  'ai:get-completion',
  'lsp:restart',
  'settings:save',
  'settings:store',
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
])

const assertAllowedChannel = (method: string, allowList: Set<string>, channel: string): void => {
  if (!allowList.has(channel)) {
    throw new Error(`Blocked ipcRenderer.${method}() on channel "${channel}"`)
  }
}

// Map from user callback → per-channel wrapper, so removeListener can find the right wrapper
const listenerWrappers = new Map<(...args: any[]) => void, Map<string, (...args: any[]) => void>>()

/**
 * Prepare a value for the structured clone used by Electron IPC.
 *
 * Functions and circular references cannot cross the bridge: they are rejected
 * here (with a clear error) instead of throwing a bare DataCloneError later or
 * hanging forever. Date/Map/Set are left untouched — the structured clone
 * algorithm serializes them natively, while a deep copy would silently
 * downgrade them (Date → {}).
 */
const toCloneable = <T>(value: T, seen: WeakSet<object> = new WeakSet()): T => {
  if (typeof value === 'function') {
    throw new TypeError('toCloneable: functions cannot be passed over IPC')
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  if (value instanceof Date || value instanceof Map || value instanceof Set || value instanceof RegExp) {
    return value
  }

  if (seen.has(value as unknown as object)) {
    throw new TypeError('toCloneable: circular reference cannot be passed over IPC')
  }
  seen.add(value as unknown as object)

  if (Array.isArray(value)) {
    return value.map(item => toCloneable(item, seen)) as T
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toCloneable(item, seen)])
  ) as T
}

const ipcRendererHandler: IpcRenderer = {
  invoke: (channel: string, ...args: any[]) => {
    assertAllowedChannel('invoke', invokeAllowList, channel)
    return ipcRenderer.invoke(channel, ...args.map(arg => toCloneable(arg)))
  },
  send: (channel: string, ...args: any[]) => {
    assertAllowedChannel('send', sendAllowList, channel)
    ipcRenderer.send(channel, ...args.map(arg => toCloneable(arg)))
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    assertAllowedChannel('on', onAllowList, channel)
    // Idempotent like DOM addEventListener: registering the same callback on
    // the same channel twice must not leak a second permanent subscription
    if (listenerWrappers.get(callback)?.has(channel)) {
      return
    }
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

const resolveLspPort = (): number => {
  const parsed = parseInt(process.env.VITE_LSP_WEBSOCKET_PORT || String(LSP_WEBSOCKET_DEFAULT_PORT), 10)
  // A malformed env must not produce ws://127.0.0.1:NaN (retried forever)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return LSP_WEBSOCKET_DEFAULT_PORT
  }
  return parsed
}

contextBridge.exposeInMainWorld('platformInfo', {
  getPlatform: () => process.platform,
  getLspPort: resolveLspPort,
  isDev: () => process.env.NODE_ENV === 'development',
})

interface HistoryReply {
  tabId: number
  data: { code: string; cursor: monaco.IPosition } | null
  error: string | null
}

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
  onUndoReply: (callback: (data: { code: string; cursor: monaco.IPosition }, tabId: number) => void) => {
    ipcRenderer.on('code-history:undo:reply', (_event, args: HistoryReply) => {
      if (args.error) {
        console.error(`Code history undo failed: ${args.error}`)
        return
      }
      if (args.data) {
        callback(args.data, args.tabId)
      }
    })
  },
  onRedoReply: (callback: (data: { code: string; cursor: monaco.IPosition }, tabId: number) => void) => {
    ipcRenderer.on('code-history:redo:reply', (_event, args: HistoryReply) => {
      if (args.error) {
        console.error(`Code history redo failed: ${args.error}`)
        return
      }
      if (args.data) {
        callback(args.data, args.tabId)
      }
    })
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('code-history:undo:reply')
    ipcRenderer.removeAllListeners('code-history:redo:reply')
  },
})
