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

    const ready = window.ipcRenderer.invoke('storage:connections:list').then((stored: any[]) => {
      connections.value = stored
        .filter(connection => connection.type === storageKey.replace('-connections', ''))
        .map(connection => normalize({ ...connection, id: Number(connection.id) || connection.id })) as T[]
    })

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

    const remove = (id: number) => {
      const index = connections.value.findIndex(c => c.id === id)
      if (index !== -1) {
        connections.value.splice(index, 1)
        void window.ipcRenderer.invoke('storage:connections:delete', id)
      }
    }

    return { connections, setConnecting, connecting, remove, getConnection, addConnection, updateConnection, ready }
  })
}
