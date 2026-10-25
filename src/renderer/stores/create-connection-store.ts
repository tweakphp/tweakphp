import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { toPlain } from '../storage'

export function createConnectionStore<T extends { id: number }>(
  storeName: string,
  storageKey: string,
  normalize: (raw: any) => T
) {
  return defineStore(storeName, () => {
    const connections: Ref<T[]> = ref([]) as Ref<T[]>
    const connecting = ref(false)

    const load = async () => {
      const stored: any[] = await window.ipcRenderer.invoke('storage:connections:list')
      connections.value = stored
        .filter(connection => connection.type === storageKey.replace('-connections', ''))
        .map(connection => normalize({ ...connection, id: Number(connection.id) || connection.id })) as T[]
      return connections.value
    }

    const ready = load()

    const getConnection = (id: number): T | undefined => {
      return connections.value.find(c => c.id === id)
    }

    const setConnecting = (value: any) => {
      connecting.value = value
    }

    const addConnection = (config: T) => {
      connections.value.push(config)
      void window.ipcRenderer.invoke('storage:connections:save', toPlain(config))
    }

    const updateConnection = (id: number, config: T): void => {
      const index = connections.value.findIndex(c => c.id === id)
      if (index !== -1) {
        connections.value[index] = config
        void window.ipcRenderer.invoke('storage:connections:save', toPlain(config))
      }
    }

    // Insert or update by id in one call (used by the docker connect flow)
    const upsertConnection = (config: T): void => {
      const index = connections.value.findIndex(c => c.id === config.id)
      if (index !== -1) {
        connections.value[index] = config
      } else {
        connections.value.push(config)
      }
      void window.ipcRenderer.invoke('storage:connections:save', toPlain(config))
    }

    const remove = (id: number) => {
      const index = connections.value.findIndex(c => c.id === id)
      if (index !== -1) {
        connections.value.splice(index, 1)
        void window.ipcRenderer.invoke('storage:connections:delete', id)
      }
    }

    // Push sync: reload when the main process signals external changes (MCP writes)
    window.ipcRenderer.on('app:connections:changed', () => {
      void load()
    })

    return {
      connections,
      setConnecting,
      connecting,
      remove,
      getConnection,
      addConnection,
      updateConnection,
      upsertConnection,
      reload: load,
      ready,
    }
  })
}
