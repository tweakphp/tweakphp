import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useHistoryStore = defineStore('history', () => {
    let defaultHistory = []
    let storedHistory = localStorage.getItem('history')
    if (storedHistory) {
        defaultHistory = JSON.parse(storedHistory)
    }
    const history = ref(defaultHistory)

    const addHistory = path => {
        // history must be unique
        let exists = history.value.find(item => item === path)
        if (exists) {
            return
        }
        history.value.push(path)
        localStorage.setItem('history', JSON.stringify(history.value))
    }

    const removeHistory = path => {
        let index = history.value.findIndex(item => item === path)
        if (index === -1) {
            return
        }
        history.value.splice(index, 1)
        localStorage.setItem('history', JSON.stringify(history.value))
    }

    return { history, addHistory, removeHistory }
})
