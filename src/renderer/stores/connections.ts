import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Unified view over the connections table (all types: local, docker, ssh,
 * kubectl, vapor). Used to resolve a tab's active connection via
 * tab.connection_id and to keep the renderer in sync when connections are
 * created/updated/deleted from outside the renderer (e.g. via MCP tools).
 */
export const useConnectionsStore = defineStore('connections', () => {
  const connections: Ref<any[]> = ref([])

  const load = async () => {
    const stored = await window.ipcRenderer.invoke('storage:connections:list')
    connections.value = stored ?? []
    return connections.value
  }

  const ready = load()

  const getConnection = (id: string | number | null | undefined) => {
    if (id === null || id === undefined || id === '') {
      return undefined
    }
    return connections.value.find(connection => String(connection.id) === String(id))
  }

  // Push sync: reload when the main process signals external changes (MCP writes)
  const onConnectionsChanged = () => {
    void load()
  }
  window.ipcRenderer.on('app:connections:changed', onConnectionsChanged)

  return { connections, getConnection, reload: load, ready }
})
