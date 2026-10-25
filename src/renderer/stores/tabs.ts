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
import { useVaporStore } from './vapor.ts'
import { useConnectionsStore } from './connections.ts'
import { storage, repositoryStorageKeys, toPlain } from '../storage'

export const useTabsStore = defineStore('tabs', () => {
  // setup tabs
  const tabs: Ref<Tab[]> = ref([])
  const current: Ref<Tab | null> = ref(null)
  const scrollPosition = ref(0)
  // Incremented after every external reload (MCP push sync): views holding a
  // local tab reference (CodeView) watch this to re-sync with the store.
  const reloadVersion = ref(0)
  const settingsStore = useSettingsStore()
  const sshStore = useSSHStore()
  const vaporStore = useVaporStore()
  const connectionsStore = useConnectionsStore()

  const ready = Promise.all([
    window.ipcRenderer.invoke('storage:tabs:list'),
    storage.get<string>(repositoryStorageKeys.currentTab),
  ]).then(([storedTabs, currentTabId]) => {
    tabs.value = (storedTabs as any[]).filter(tab => tab.type !== 'home').map(normalize)
    current.value = findTab(currentTabId ? parseInt(currentTabId) : null)
  })

  // Push sync: reload tabs from the database when the main process signals
  // external changes (MCP tools). Unsaved editor content of the current tab
  // wins over the database (last-write-wins for the active editor) — unless
  // the change is a code write for that very tab (codeUpdatedForTabId).
  const reloadFromDb = async (
    changes?: {
      currentProjectId?: number
      codeUpdatedForTabId?: number
    } | null
  ) => {
    const storedTabs = (await window.ipcRenderer.invoke('storage:tabs:list')) as any[]
    const previousCurrent = current.value
    const reloaded = storedTabs.filter(tab => tab.type !== 'home').map(normalize)

    if (previousCurrent) {
      const refreshed = reloaded.find(tab => tab.id === previousCurrent.id)
      if (refreshed) {
        const keepLocalCode = changes?.codeUpdatedForTabId !== previousCurrent.id
        if (keepLocalCode) {
          // keep in-memory editor state for the tab the user is working on
          refreshed.code = previousCurrent.code
        }
        refreshed.result = previousCurrent.result
        refreshed.queries = previousCurrent.queries
        refreshed.pane = previousCurrent.pane
      }
    }

    tabs.value = reloaded
    current.value = findTab(changes?.currentProjectId ?? current.value?.id ?? null)
    reloadVersion.value++
    return tabs.value
  }
  window.ipcRenderer.on('app:tabs:changed', (payload?: { currentProjectId?: number; codeUpdatedForTabId?: number }) => {
    void reloadFromDb(payload ?? null)
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

    // Connections are atomic to a project: the clone must own its own copy
    // of the source's active connection (never share the source's row)
    if (source.execution !== 'vapor' && source.connection_id) {
      const active = connectionsStore.getConnection(source.connection_id)
      if (active) {
        const copyId = Date.now()
        void window.ipcRenderer.invoke('storage:connections:save', {
          ...toPlain(active),
          id: copyId,
          tab_id: clone.id,
        })
        clone.connection_id = String(copyId)
      }
    }

    tabs.value.splice(index + 1, 0, clone)
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))

    // Vapor connection configs are keyed by tab id: copy the source config over
    if (source.execution === 'vapor') {
      clone.connection_id = String(clone.id)
      const config = vaporStore.getConnectionConfig(source.id)
      if (config) {
        vaporStore.setEnviroments(clone.id, [...config.environments])
        vaporStore.setClientPath(clone.id, config.client_path)
        vaporStore.setEnvironment(clone.id, config.environment)
      }
      void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
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

    if (execution === 'docker') {
      const stored = tab.connection_id ? connectionsStore.getConnection(tab.connection_id) : undefined
      if (stored && stored.type === 'docker') {
        // clone: never persist the embedded ssh credentials on the tab itself
        connection = { ...(stored as DockerConnectionConfig) }
        if (connection.ssh_id) {
          connection.ssh = sshStore.getConnection(connection.ssh_id)
        }
      }
    }

    if (execution === 'vapor') {
      connection = vaporStore.getConnectionConfig(tab.id)
    }

    if (execution === 'ssh') {
      const stored = tab.connection_id ? connectionsStore.getConnection(tab.connection_id) : undefined
      if (stored && stored.type === 'ssh') {
        connection = stored as SSHConnectionConfig
      }
    }

    if (execution === 'kubectl') {
      const stored = tab.connection_id ? connectionsStore.getConnection(tab.connection_id) : undefined
      if (stored && stored.type === 'kubectl') {
        connection = stored as KubectlConnectionConfig
      }
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

  const updateTabColor = (tabId: number, color: string | null) => {
    const tabToUpdate = tabs.value.find(tab => tab.id === tabId)
    if (!tabToUpdate) {
      return
    }
    tabToUpdate.color = color
    updateTab(tabToUpdate)
  }

  const updateTabTag = (tabId: number, tag: string | null) => {
    const tabToUpdate = tabs.value.find(tab => tab.id === tabId)
    if (!tabToUpdate) {
      return
    }
    tabToUpdate.tag = tag
    updateTab(tabToUpdate)
  }

  const moveTab = (tabId: number, folderId: number | null, index: number) => {
    const tabIndex = tabs.value.findIndex(t => t.id === tabId)
    if (tabIndex === -1) {
      return
    }
    const [tab] = tabs.value.splice(tabIndex, 1)
    tab.folder_id = folderId

    // index refers to the displayed (unpinned) members of the group: the tab
    // lands at that position, keeping array order aligned with display order
    const group = tabs.value.filter(t => (t.folder_id ?? null) === folderId && !t.pinned)
    const clamped = Math.max(0, Math.min(index, group.length))

    let insertAt: number
    if (clamped < group.length) {
      insertAt = tabs.value.findIndex(t => t.id === group[clamped].id)
    } else {
      const anchor = group[group.length - 1]
      insertAt = anchor ? tabs.value.findIndex(t => t.id === anchor.id) + 1 : tabs.value.length
    }

    tabs.value.splice(insertAt, 0, tab)
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
  }

  // Called by drag & drop with the new content of a group (root or folder).
  // Handles both full lists and visible slices (Show more): hidden members
  // are kept at the end of the group. Elements that are not known tabs
  // (e.g. a folder) are ignored to avoid corrupting the tabs store.
  // Pinned tabs live in the Pinned section: dropping a tab into a folder or
  // into Recent unpins it.
  const applyGroupOrder = (folderId: number | null, orderedTabs: Tab[]) => {
    const knownIds = new Set(tabs.value.map(t => t.id))
    const ordered = orderedTabs.filter(t => knownIds.has(t.id))
    const orderedIds = new Set(ordered.map(t => t.id))
    const tail = tabs.value.filter(t => (t.folder_id ?? null) === folderId && !orderedIds.has(t.id))
    const tailIds = new Set(tail.map(t => t.id))
    ordered.forEach(tab => {
      tab.folder_id = folderId
      tab.pinned = false
    })
    const rest = tabs.value.filter(t => !orderedIds.has(t.id) && !tailIds.has(t.id))
    tabs.value = [...rest, ...ordered, ...tail]
    void window.ipcRenderer.invoke('storage:tabs:save-all', toPlain(tabs.value))
  }

  // Called by drag & drop with the new content of the Pinned section. Every
  // tab in the list becomes pinned (dragging a tab into the section pins
  // it); folder membership is preserved so unpinning returns the tab to its
  // folder. Elements that are not known tabs are ignored.
  const applyPinnedOrder = (orderedTabs: Tab[]) => {
    const knownIds = new Set(tabs.value.map(t => t.id))
    const ordered = orderedTabs.filter(t => knownIds.has(t.id))
    const orderedIds = new Set(ordered.map(t => t.id))
    ordered.forEach(tab => {
      tab.pinned = true
    })
    const rest = tabs.value.filter(t => !orderedIds.has(t.id))
    tabs.value = [...ordered, ...rest]
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
    reloadVersion,
    addTab,
    duplicateTab,
    removeTab,
    updateTab,
    findTab,
    setCurrent,
    getCurrent,
    updateTabName,
    updateTabColor,
    updateTabTag,
    moveTab,
    applyGroupOrder,
    applyPinnedOrder,
    togglePin,
    detachFolder,
    removeFolderTabs,
    scrollPosition,
    setScrollPosition,
    getConnectionConfig,
    reloadFromDb,
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
    connection_id: (tab.connection_id as string | null) ?? null,
    loader: tab.loader as string,
    folder_id: (tab.folder_id as number | null) ?? null,
    pinned: Boolean(tab.pinned),
    color: (tab.color as string | null) ?? null,
    tag: (tab.tag as string | null) ?? null,
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

  return t
}
