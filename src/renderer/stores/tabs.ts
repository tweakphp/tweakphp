import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { Tab } from '../types/tab.type'
import router from '../router'

export const useTabsStore = defineStore('tabs', () => {
  // setup tabs
  let defaultTabs = [
    {
      id: Date.now(),
      type: 'home',
      name: 'home',
      path: '',
      execution: 'local',
      remote_path: '',
      remote_phar_client: '',
      code: '<?php\n\n',
      result: '',
      pane: {
        code: 50,
        result: 50,
      },
      info: {
        name: '',
        version: '',
        php_version: '',
      },
      docker: {
        enable: false,
        php: '',
        container_name: '',
        container_id: '',
        php_version: '',
      },
      docker_ssh: {
        ssh_id: 0,
        php: '',
        docker_path: '',
        container_name: '',
        container_id: '',
        php_version: '',
        phar_client: '',
        working_directory: '',
      },
    },
  ]
  let storedTabs = localStorage.getItem('tabs')
  if (storedTabs) {
    defaultTabs = JSON.parse(storedTabs)
      .filter((tab: Tab) => tab.type !== 'home')
      .map((tab: Tab) => ({
        ...tab,
        pane: tab.pane || defaultTabs[0].pane,
        execution: tab.execution as 'local' | 'ssh' | 'docker',
        docker: tab.docker || defaultTabs[0].docker,
      }))
  }
  const tabs: Ref<Tab[]> = ref(defaultTabs)
  const current: Ref<Tab | null> = ref(null)
  const scrollPosition = ref(0)

  const setCurrent = (tab: Tab | null): void => {
    current.value = tab
    if (tab) {
      localStorage.setItem('currentTab', tab.id.toString())
      return
    }
    localStorage.removeItem('currentTab')
  }

  const getCurrent = (): Tab | null => {
    if (current.value) {
      return current.value
    }
    let id = localStorage.getItem('currentTab')
    return findTab(id ? parseInt(id) : null)
  }

  const addTab = (data: { id?: number | null; type: string; path?: string } = { type: 'home' }) => {
    if (!data.id) {
      data.id = Date.now()
    }

    const pathSplitter = window.platformInfo.getPlatform() === 'win32' ? '\\' : '/'

    let tab: Tab = {
      id: data.id,
      type: data.type,
      name: data.type === 'home' ? 'home' : (data.path?.split(pathSplitter).pop() as string),
      path: data.path,
      execution: 'local',
      remote_phar_client: '',
      remote_path: '',
      code: '<?php\n\n',
      result: '',
      pane: {
        code: 50,
        result: 50,
      },
      info: {
        name: '',
        version: '',
        php_version: '',
      },
      docker: {
        enable: false,
        php: '',
        container_id: '',
        container_name: '',
        php_version: '',
      },
      docker_ssh: {
        ssh_id: '',
        php: '',
        docker_path: '',
        container_name: '',
        container_id: '',
        php_version: '',
        phar_client: '',
        working_directory: '',
      },
    }
    let tabExists = tabs.value.find(t => t.id === tab.id)
    if (tabExists) {
      return tabExists
    }
    tabs.value.push(tab)
    localStorage.setItem('tabs', JSON.stringify(tabs.value))
    setCurrent(tab)
    return tab
  }

  const removeTab = async (id: number) => {
    let index = tabs.value.findIndex(tab => tab.id === id)
    tabs.value.splice(index, 1)
    localStorage.setItem('tabs', JSON.stringify(tabs.value))
    if (tabs.value.length > 0) {
      setCurrent(tabs.value[tabs.value.length - 1])
      let activeTab = tabs.value[tabs.value.length - 1]
      await router.replace({ name: 'code', params: { id: activeTab.id } })
      return activeTab
    }
    setCurrent(null)
    await router.replace({ name: 'home' })
    return null
  }

  const updateTab = (tab: Tab) => {
    let index = tabs.value.findIndex(t => t.id === tab.id)
    tabs.value[index] = tab
    localStorage.setItem('tabs', JSON.stringify(tabs.value))
  }

  const findTab = (id: number | null = null) => {
    if (!id) {
      if (tabs.value.length > 0) {
        return tabs.value[tabs.value.length - 1]
      }
      id = Date.now()
    }
    let index = tabs.value.findIndex(t => t.id == id)
    let tab = tabs.value[index]
    if (tab) {
      return tab
    }
    return null
  }

  const setScrollPosition = (position: number) => {
    scrollPosition.value = position
  }

  return {
    tabs,
    current,
    addTab,
    removeTab,
    updateTab,
    findTab,
    setCurrent,
    getCurrent,
    scrollPosition,
    setScrollPosition,
  }
})
