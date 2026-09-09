import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { toPlain } from '../storage'

/** Connection ids are numeric (Date.now()) but may surface as strings from the DB. */
export type ConnectionId = number | string

/**
 * Prefer the numeric representation when the id is parseable as a number,
 * otherwise keep the raw value (e.g. legacy UUID string ids).
 */
export function normalizeConnectionId(raw: any): ConnectionId {
  return Number(raw) || raw
}

/**
 * Representation-agnostic id comparison: matches numeric ids stored as
 * strings ("123" vs 123) and vice versa, so a DOM select or a DB round-trip
 * cannot silently break connection references.
 */
export function isSameConnectionId(a: any, b: any): boolean {
  return a === b || String(a) === String(b)
}

export function createConnectionStore<T extends { id: ConnectionId }>(
  storeName: string,
  storageKey: string,
  normalize: (raw: any) => T
) {
  return defineStore(storeName, () => {
    const connections: Ref<T[]> = ref([]) as Ref<T[]>
    const connecting = ref(false)

    const ready = window.ipcRenderer.invoke('storage:connections:list').then((stored: any[]) => {
      connections.value = stored
        .filter(connection => connection.type === storageKey.replace('-connections', ''))
        .map(connection => normalize({ ...connection, id: normalizeConnectionId(connection.id) })) as T[]
    })

    const getConnection = (id: ConnectionId): T | undefined => {
      return connections.value.find(c => isSameConnectionId(c.id, id))
    }

    const setConnecting = (value: any) => {
      connecting.value = value
    }

    const addConnection = (config: T) => {
      const withNormalizedId = { ...config, id: normalizeConnectionId((config as any).id) }
      connections.value.push(withNormalizedId)
      void window.ipcRenderer.invoke('storage:connections:save', toPlain(withNormalizedId))
    }

    const updateConnection = (id: ConnectionId, config: T): void => {
      const index = connections.value.findIndex(c => isSameConnectionId(c.id, id))
      if (index !== -1) {
        const withNormalizedId = { ...config, id: normalizeConnectionId((config as any).id) }
        connections.value[index] = withNormalizedId
        void window.ipcRenderer.invoke('storage:connections:save', toPlain(withNormalizedId))
      }
    }

    const remove = (id: ConnectionId) => {
      const index = connections.value.findIndex(c => isSameConnectionId(c.id, id))
      if (index !== -1) {
        connections.value.splice(index, 1)
        void window.ipcRenderer.invoke('storage:connections:delete', id)
      }
    }

    return { connections, setConnecting, connecting, remove, getConnection, addConnection, updateConnection, ready }
  })
}
