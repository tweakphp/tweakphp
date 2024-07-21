const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ipcRenderer', {
    send: (channel, data) => {
        ipcRenderer.send(channel, data)
    },
    receive: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args))
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback)
    },
})
