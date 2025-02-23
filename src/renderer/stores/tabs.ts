import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { Tab, Result } from '../../types/tab.type'
import router from '../router'
import { ConnectionConfig as LocalConnectionConfig } from '../../types/local.type'
import { ConnectionConfig as SSHConnectionConfig } from '../../types/ssh.type'
import { ConnectionConfig as DockerConnectionConfig } from '../../types/docker.type'
import { ConnectionConfig as KubectlConnectionConfig } from '../../types/kubectl.type'
import { useSettingsStore } from './settings'
import { useSSHStore } from './ssh'
import { useKubectlStore } from './kubectl'

export const useTabsStore = defineStore('tabs', () => {
  // setup tabs
  let defaultTabs = []
  let storedTabs = localStorage.getItem('tabs')
  if (storedTabs) {
    defaultTabs = JSON.parse(storedTabs)
      .filter((tab: any) => tab.type !== 'home')
      .map((tab: any) => {
        return normalize(tab)
      })
  }
  const tabs: Ref<Tab[]> = ref(defaultTabs)
  const current: Ref<Tab | null> = ref(null)
  const scrollPosition = ref(0)
  const settingsStore = useSettingsStore()
  const sshStore = useSSHStore()
  const kubectlStore = useKubectlStore()

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

  const addTab = (data: { id?: number | null; type: string; path: string }) => {
    if (!data.id) {
      data.id = Date.now()
    }

    const pathSplitter = window.platformInfo.getPlatform() === 'win32' ? '\\' : '/'

    let tab: Tab = {
      id: data.id,
      type: data.type,
      name: data.path.split(pathSplitter).pop() as string,
      path: data.path,
      execution: 'local',
      code: '<?php\n\n',
      result: [],
      pane: {
        code: 50,
        result: 50,
      },
      info: {
        name: '',
        version: '',
        php_version: '',
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

  const getConnectionConfig = (tab: Tab, execution?: string) => {
    let connection:
      | LocalConnectionConfig
      | SSHConnectionConfig
      | DockerConnectionConfig
      | KubectlConnectionConfig
      | undefined

    if (!execution) {
      execution = tab.execution
    }

    if (execution === 'local') {
      connection = {
        type: 'local',
        path: tab.path ?? '',
        php: settingsStore.settings.php,
      }
    }

    if (execution === 'docker' && tab.docker) {
      connection = tab.docker
      if (tab.docker.ssh_id) {
        connection.ssh = sshStore.getConnection(tab.docker.ssh_id)
      }
    }

    if (execution === 'ssh' && tab.ssh) {
      connection = sshStore.getConnection(tab.ssh.id)
    }

    if (execution === 'kubectl' && tab.kubectl) {
      connection = kubectlStore.getConnection(tab.kubectl.id)
    }

    return connection
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
    getConnectionConfig,
  }
})

const normalize = (tab: any): Tab => {
  const isResultArray = (arr: any): arr is Result[] => {
    return (
      Array.isArray(arr) &&
      arr.every(
        item => typeof item.line === 'number' && typeof item.code === 'string' && typeof item.output === 'string'
      )
    )
  }

  let t: Tab = {
    id: (tab.id as number) ?? Date.now(),
    name: tab.name as string,
    type: tab.type as string,
    code: (tab.code as string) ?? '',
    path: tab.path as string | undefined,
    execution: (tab.execution as 'local' | 'ssh' | 'docker' | 'kubectl') ?? 'local',
    loader: tab.loader as string,
    result: isResultArray(tab.result) ? tab.result : [{ line: 0, code: '', output: tab.result }],
    pane: {
      code: (tab.pane?.code as number) ?? 50,
      result: (tab.pane?.result as number) ?? 50,
    },
    info: {
      name: (tab.info?.name as string) ?? '',
      php_version: (tab.info?.php_version as string) ?? '',
      version: (tab.info?.version as string) ?? '',
    },
  }
  if (tab.docker && tab.docker.container_name) {
    t.docker = {
      type: 'docker',
      working_directory: tab.docker.working_directory,
      container_id: tab.docker.container_id,
      container_name: tab.docker.container_name,
      php_version: tab.docker.php_version ?? '',
      php_path: tab.docker.php_path ?? '',
      client_path: tab.docker.client_path ?? tab.docker.phar_path,
      ssh_id: tab.docker.ssh_id ?? 0,
    }
  }

  if (tab.ssh && tab.ssh.id) {
    t.ssh = {
      id: tab.ssh.id,
    }
  }

  if (tab.kubectl && tab.kubectl.id) {
    t.kubectl = {
      id: tab.kubectl.id,
    }
  }

  return t
}
