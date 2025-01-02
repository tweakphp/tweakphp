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

  const connect = (data: ConnectionConfig) => {
    setConnecting(true)
    window.ipcRenderer.send('ssh.connect', {
      ...data,
    })
  }

  const setConnecting = (value: any) => {
    connecting.value = value
  }

  const connectReply = (data: any) => {
    setConnecting(false)
    console.log(data)
    if (data.detail.connected) {
      connections.value.push(data.detail.config)
      localStorage.setItem('ssh-connections', JSON.stringify(connections.value))
    }
  }

  return { connections, connect, setConnecting, connecting, connectReply }
})
