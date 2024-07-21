import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useTabsStore = defineStore('tabs', () => {
    // setup tabs
    let defaultTabs = [
        {
            id: Date.now(),
            type: 'home',
            name: 'home',
            path: null,
            code: '',
            result: '',
            info: {
                name: '',
                version: '',
            },
        },
    ]
    let storedTabs = localStorage.getItem('tabs')
    if (storedTabs) {
        defaultTabs = JSON.parse(storedTabs)
    }
    const tabs = ref(defaultTabs)

    const addTab = (data = { id: Date.now(), type: 'home', path: null }) => {
        if (!parseInt(data.id)) {
            data.id = Date.now()
        }
        let tab = {
            id: parseInt(data.id),
            type: data.type,
            name: data.type === 'home' ? 'home' : data.path.split('/').pop(),
            path: data.path,
            code: '<?php\n\n',
            result: '',
            info: {
                name: '',
                version: '',
            },
        }
        let tabExists = tabs.value.find(t => t.id === tab.id)
        if (tabExists) {
            return tabExists
        }
        tabs.value.push(tab)
        localStorage.setItem('tabs', JSON.stringify(tabs.value))
        return tab
    }

    const removeTab = id => {
        let index = tabs.value.findIndex(tab => tab.id === id)
        tabs.value.splice(index, 1)
        localStorage.setItem('tabs', JSON.stringify(tabs.value))
        if (tabs.value.length > 0) {
            return tabs.value[tabs.value.length - 1]
        }
        return addTab({
            id: Date.now(),
            type: 'home',
            path: null,
        })
    }

    const updateTab = tab => {
        let index = tabs.value.findIndex(t => t.id === tab.id)
        tabs.value[index] = tab
        localStorage.setItem('tabs', JSON.stringify(tabs.value))
    }

    const findTab = (id = null) => {
        if (!id) {
            if (tabs.value.length > 0) {
                return tabs.value[tabs.value.length - 1]
            }
            id = Date.now()
        }
        let index = tabs.value.findIndex(t => t.id === id)
        let tab = tabs.value[index]
        if (!tab) {
            tab = addTab({
                id: id,
                type: 'home',
                path: null,
            })
        }
        return tab
    }

    return {
        tabs,
        addTab,
        removeTab,
        updateTab,
        findTab,
    }
})
