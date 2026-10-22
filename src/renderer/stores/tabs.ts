import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { Tab, Result } from '../../types/tab.type'
import router from '../router'
import { ConnectionConfig as LocalConnectionConfig } from '../../types/local.type'
import { ConnectionConfig as SSHConnectionConfig } from '../../types/ssh.type'
import { ConnectionConfig as VaporConnectionConfig } from '../../types/vapor.type'
import { ConnectionConfig as DockerConnectionConfig } from '../../types/docker.type'
import { ConnectionConfig as KubectlConnectionConfig } from '../../types/kubectl.type'
import { useSettingsStore } from './settings'
import { useSSHStore } from './ssh'
import { useKubectlStore } from './kubectl'
import { useVaporStore } from './vapor.ts'
import { storage, repositoryStorageKeys, toPlain } from '../storage'

export const useTabsStore = defineStore('tabs', () => {
  // setup tabs
  const tabs: Ref<Tab[]> = ref([])
  const current: Ref<Tab | null> = ref(null)
  const scrollPosition = ref(0)
  const settingsStore = useSettingsStore()
  const sshStore = useSSHStore()
  const kubectlStore = useKubectlStore()
  const vaporStore = useVaporStore()

  const ready = Promise.all([
    window.ipcRenderer.invoke('storage:tabs:list'),
    storage.get<string>(repositoryStorageKeys.currentTab),
  ]).then(([storedTabs, currentTabId]) => {
    tabs.value = (storedTabs as any[]).filter(tab => tab.type !== 'home').map(normalize)
    current.value = findTab(currentTabId ? parseInt(currentTabId) : null)
  })

  const setCurrent = (tab: Tab | null): void => {
    current.value = tab
    if (tab) {
      void storage.set(repositoryStorageKeys.currentTab, tab.id.toString())
      return
    }
    void storage.remove(repositoryStorageKeys.currentTab)
  }

  const getCurrent = (): Tab | null => {
    if (current.value) {
      return current.value
    }
    return findTab()
  }

  const insertTabInGroup = (tab: Tab) => {
    // New workspaces enter at the top of their group (root or folder)
    const folderId = tab.folder_id ?? null
    const firstIndex = tabs.value.findIndex(t => (t.folder_id ?? null) === folderId)
    if (firstIndex === -1) {
      tabs.value.push(tab)
      return
    }
    tabs.value.splice(firstIndex, 0, tab)
  }

  const addTab = (data: { id?: number | null; type: string; path: string; folderId?: number | null }) => {
    if (!data.id) {
      data.id = Date.now()
    }

    let tab: Tab = {
      id: data.id,
      type: data.type,
      name: data.path.split(/[/\\]/).pop() as string,
      path: data.path,
      execution: 'local',
      code: '<?php\n\n',
      result: [],
      queries: [],
      folder_id: data.folderId ?? null,
      pinned: false,
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
    insertTabInGroup(tab)
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
    setCurrent(tab)
    return tab
  }

  // Clones a tab (code, name, path, folder, pin state...) with a fresh id,
  // placed right after the original in its group, and activates it.
  const duplicateTab = async (tabId: number) => {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) {
      return null
    }
    const source = tabs.value[index]
    const clone = { ...toPlain(source), id: Date.now() } as Tab
    tabs.value.splice(index + 1, 0, clone)
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))

    // Vapor connection configs are keyed by tab id: copy the source config over
    if (source.execution === 'vapor') {
      const config = vaporStore.getConnectionConfig(source.id)
      if (config) {
        vaporStore.setEnviroments(clone.id, [...config.environments])
        vaporStore.setClientPath(clone.id, config.client_path)
        vaporStore.setEnvironment(clone.id, config.environment)
      }
    }

    setCurrent(clone)
    await router.replace({ name: 'code', params: { id: clone.id } })
    return clone
  }

  const removeTab = async (id: number) => {
    let index = tabs.value.findIndex(tab => tab.id === id)
    if (index === -1) {
      return null
    }
    const [removed] = tabs.value.splice(index, 1)
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
    if (removed.execution === 'vapor') {
      vaporStore.removeVaporConfig(id)
    }
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
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
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
      | VaporConnectionConfig
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

    if (execution === 'vapor') {
      connection = vaporStore.getConnectionConfig(tab.id)
    }

    if (execution === 'ssh' && tab.ssh) {
      connection = sshStore.getConnection(tab.ssh.id)
    }

    if (execution === 'kubectl' && tab.kubectl) {
      connection = kubectlStore.getConnection(tab.kubectl.id)
    }

    return connection
  }

  const updateTabName = (tabId: number, newName: string) => {
    const tabToUpdate = tabs.value.find(tab => tab.id === tabId)
    if (tabToUpdate && newName.trim() !== '') {
      tabToUpdate.name = newName.trim()
      updateTab(tabToUpdate)
    }
  }

  const moveTab = (tabId: number, folderId: number | null, index: number) => {
    const tabIndex = tabs.value.findIndex(t => t.id === tabId)
    if (tabIndex === -1) {
      return
    }
    const [tab] = tabs.value.splice(tabIndex, 1)
    tab.folder_id = folderId

    // index refers to the non-pinned section of the group: the tab lands
    // right after the pinned tabs, keeping array order aligned with display order
    const group = tabs.value.filter(t => (t.folder_id ?? null) === folderId)
    const pinned = group.filter(t => t.pinned)
    const unpinned = group.filter(t => !t.pinned)
    const clamped = Math.max(0, Math.min(index, unpinned.length))

    let insertAt: number
    if (clamped < unpinned.length) {
      insertAt = tabs.value.findIndex(t => t.id === unpinned[clamped].id)
    } else {
      const anchor = unpinned[unpinned.length - 1] ?? pinned[pinned.length - 1]
      insertAt = anchor ? tabs.value.findIndex(t => t.id === anchor.id) + 1 : tabs.value.length
    }

    tabs.value.splice(insertAt, 0, tab)
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
  }

  // Called by drag & drop with the new content of a group (root or folder).
  // Handles both full lists and visible slices (Show more): hidden members
  // are kept at the end of the group.
  const applyGroupOrder = (folderId: number | null, orderedTabs: Tab[]) => {
    const orderedIds = new Set(orderedTabs.map(t => t.id))
    const tail = tabs.value.filter(t => (t.folder_id ?? null) === folderId && !orderedIds.has(t.id))
    const tailIds = new Set(tail.map(t => t.id))
    orderedTabs.forEach(tab => {
      tab.folder_id = folderId
    })
    const rest = tabs.value.filter(t => !orderedIds.has(t.id) && !tailIds.has(t.id))
    tabs.value = [...rest, ...orderedTabs, ...tail]
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
  }

  const togglePin = (tabId: number) => {
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) {
      return
    }
    tab.pinned = !tab.pinned
    updateTab(tab)
  }

  const detachFolder = (folderId: number) => {
    let changed = false
    tabs.value.forEach(tab => {
      if (tab.folder_id === folderId) {
        tab.folder_id = null
        changed = true
      }
    })
    if (changed) {
      void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
    }
  }

  // Bulk variant of removeTab used when deleting a folder together with its tabs
  const removeFolderTabs = async (folderId: number) => {
    const removed = tabs.value.filter(t => t.folder_id === folderId)
    if (removed.length === 0) {
      return null
    }
    const removedIds = new Set(removed.map(t => t.id))
    const removedCurrent = current.value ? removedIds.has(current.value.id) : false
    tabs.value = tabs.value.filter(t => !removedIds.has(t.id))
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
    removed.forEach(tab => {
      if (tab.execution === 'vapor') {
        vaporStore.removeVaporConfig(tab.id)
      }
    })
    if (!removedCurrent) {
      return null
    }
    if (tabs.value.length > 0) {
      const activeTab = tabs.value[tabs.value.length - 1]
      setCurrent(activeTab)
      await router.replace({ name: 'code', params: { id: activeTab.id } })
      return activeTab
    }
    setCurrent(null)
    await router.replace({ name: 'home' })
    return null
  }

  return {
    tabs,
    current,
    addTab,
    duplicateTab,
    removeTab,
    updateTab,
    findTab,
    setCurrent,
    getCurrent,
    updateTabName,
    moveTab,
    applyGroupOrder,
    togglePin,
    detachFolder,
    removeFolderTabs,
    scrollPosition,
    setScrollPosition,
    getConnectionConfig,
    ready,
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
    execution: (tab.execution as 'local' | 'ssh' | 'vapor' | 'docker' | 'kubectl') ?? 'local',
    loader: tab.loader as string,
    folder_id: (tab.folder_id as number | null) ?? null,
    pinned: Boolean(tab.pinned),
    result: isResultArray(tab.result) ? tab.result : [{ line: 0, code: '', output: tab.result }],
    queries: Array.isArray(tab.queries) ? tab.queries : [],
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
      user: tab.docker.user ?? '',
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
