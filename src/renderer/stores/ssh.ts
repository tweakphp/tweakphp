import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { ConnectionConfig } from '../../types/ssh.type'

export const useSSHStore = defineStore('ssh', () => {
  let storedConnections: ConnectionConfig[] = []
  const storedConnectionsRaw = localStorage.getItem('ssh-connections')
  if (storedConnectionsRaw) {
    storedConnections = JSON.parse(storedConnectionsRaw)
  }
  const connections: Ref<ConnectionConfig[]> = ref(storedConnections)
  const connecting = ref(false)

  const getConnection = (id: number): ConnectionConfig | undefined => {
    return connections.value.find(c => c.id === id)
  }

  const setConnecting = (value: any) => {
    connecting.value = value
  }

  const addConnection = (config: ConnectionConfig) => {
    connections.value.push(config)
    localStorage.setItem('ssh-connections', JSON.stringify(connections.value))
  }

  const updateConnection = (id: number, config: ConnectionConfig): void => {
    const index = connections.value.findIndex(c => c.id === id)
    if (index !== -1) {
      connections.value[index] = config
      localStorage.setItem('ssh-connections', JSON.stringify(connections.value))
    }
  }

  const remove = (id: number) => {
    const index = connections.value.findIndex(c => c.id === id)
    if (index !== -1) {
      connections.value.splice(index, 1)
      localStorage.setItem('ssh-connections', JSON.stringify(connections.value))
    }
  }

  return { connections, setConnecting, connecting, remove, getConnection, addConnection, updateConnection }
})
