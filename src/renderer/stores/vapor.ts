import { ref, Ref } from 'vue'
import { defineStore } from 'pinia'
import { ConnectionConfig } from '../../types/vapor.type'
import { integer } from 'vscode-languageserver'
import { toPlain } from '../storage'
const TYPE = 'vapor'

const normalize = (connection: any): ConnectionConfig => ({
  id: connection.id ?? 0,
  type: TYPE,
  client_path: connection.client_path ?? null,
  environment: connection.environment ?? null,
  environments: connection.environments ?? [],
})

export const useVaporStore = defineStore(TYPE, () => {
  const connectionConfigs: Ref<ConnectionConfig[]> = ref([])
  const ready = window.ipcRenderer.invoke('storage:connections:list').then((stored: any[]) => {
    connectionConfigs.value = stored
      .filter(connection => connection.type === TYPE)
      .map(connection => normalize({ ...connection, id: Number(connection.id) || connection.id }))
  })

  const persist = (config: ConnectionConfig) => {
    void window.ipcRenderer.invoke(
      'storage:connections:save',
      toPlain({
        ...config,
        name: `vapor-${config.id}`,
      })
    )
  }

  const getConnectionConfig = (id: integer | undefined | null): ConnectionConfig | undefined => {
    return connectionConfigs.value.find(c => c.id === id)
  }

  const setClientPath = (id: integer, path: string | null) => {
    const config = connectionConfigs.value.find(c => c.id === id)
    if (config) {
      config.client_path = path
      persist(config)
      return
    }

    connectionConfigs.value.push({ id, type: TYPE, client_path: path, environment: null, environments: [] })
    persist(connectionConfigs.value[connectionConfigs.value.length - 1])
  }

  const setEnviroments = (id: integer, environments: string[]) => {
    const config = connectionConfigs.value.find(c => c.id === id)
    if (config) {
      config.environments = environments
      persist(config)
      return
    }

    connectionConfigs.value.push({ id, type: TYPE, client_path: null, environment: null, environments })
    persist(connectionConfigs.value[connectionConfigs.value.length - 1])
  }

  const setEnvironment = (id: integer, environment: string | null) => {
    const config = connectionConfigs.value.find(c => c.id === id)
    if (config) {
      config.environment = environment
      persist(config)
      return
    }
    connectionConfigs.value.push({ id, type: TYPE, client_path: null, environment, environments: [] })
    persist(connectionConfigs.value[connectionConfigs.value.length - 1])
  }

  const removeEnvironment = (id: integer) => {
    const config = connectionConfigs.value.find(c => c.id === id)
    if (config) {
      config.environment = null
      persist(config)
      return
    }

    console.warn(`Vapor config with id ${id} not found for environment removal.`)
  }

  const resetVaporConfig = (id: integer) => {
    const index = connectionConfigs.value.findIndex(c => c.id === id)
    if (index !== -1) {
      connectionConfigs.value.splice(index, 1)
      void window.ipcRenderer.invoke('storage:connections:delete', id)
      return
    }

    connectionConfigs.value.push({ id, type: 'vapor', client_path: null, environment: null, environments: [] })
    persist(connectionConfigs.value[connectionConfigs.value.length - 1])
  }

  const removeVaporConfig = (id: integer) => {
    const index = connectionConfigs.value.findIndex(c => c.id === id)
    if (index !== -1) {
      connectionConfigs.value.splice(index, 1)
      void window.ipcRenderer.invoke('storage:connections:delete', id)
      return
    }
    console.warn(`Vapor config with id ${id} not found for removal.`)
  }

  return {
    getConnectionConfig,
    setClientPath,
    setEnvironment,
    removeEnvironment,
    setEnviroments,
    resetVaporConfig,
    removeVaporConfig,
    connectionConfigs,
    ready,
  }
})
