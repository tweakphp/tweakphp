import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSSHStore = defineStore('ssh', () => {
    let defaultConnections = []
    let storedConnections = localStorage.getItem('ssh-connections')
    if (storedConnections) {
        defaultConnections = JSON.parse(storedConnections)
    }
    const connections = ref(defaultConnections)
    const connecting = ref(false)

    const connect = data => {
        setConnecting(true)
        window.ipcRenderer.send('ssh.connect', data)
    }

    const setConnecting = value => {
        connecting.value = value
    }

    return { connections, connect, setConnecting }
})
