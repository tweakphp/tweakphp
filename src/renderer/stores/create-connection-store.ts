import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'

export function createConnectionStore<T extends { id: number }>(
  storeName: string,
  storageKey: string,
  normalize: (raw: any) => T
) {
  return defineStore(storeName, () => {
    let storedConnections: T[] = []
    const storedConnectionsRaw = localStorage.getItem(storageKey)
    if (storedConnectionsRaw) {
      storedConnections = JSON.parse(storedConnectionsRaw).map((connection: any) => normalize(connection))
    }
    const connections: Ref<T[]> = ref(storedConnections) as Ref<T[]>
    const connecting = ref(false)

    const persist = () => localStorage.setItem(storageKey, JSON.stringify(connections.value))

    const getConnection = (id: number): T | undefined => {
      return connections.value.find(c => c.id === id)
    }

    const setConnecting = (value: any) => {
      connecting.value = value
    }

    const addConnection = (config: T) => {
      connections.value.push(config)
      persist()
    }

    const updateConnection = (id: number, config: T): void => {
      const index = connections.value.findIndex(c => c.id === id)
      if (index !== -1) {
        connections.value[index] = config
        persist()
      }
    }

    const remove = (id: number) => {
      const index = connections.value.findIndex(c => c.id === id)
      if (index !== -1) {
        connections.value.splice(index, 1)
        persist()
      }
    }

    return { connections, setConnecting, connecting, remove, getConnection, addConnection, updateConnection }
  })
}
