import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { ArchivedTab } from '../../types/tab.type'
import { useTabsStore } from './tabs'

export const useArchiveStore = defineStore('archive', () => {
  const tabsStore = useTabsStore()

  const trashedTabs: Ref<ArchivedTab[]> = ref([])
  const loading = ref(false)

  const loadTrashed = async (): Promise<ArchivedTab[]> => {
    loading.value = true
    try {
      trashedTabs.value = (await window.ipcRenderer.invoke('storage:tabs:list-trashed')) as ArchivedTab[]
      return trashedTabs.value
    } finally {
      loading.value = false
    }
  }

  const restore = async (id: number): Promise<boolean> => {
    const { success } = (await window.ipcRenderer.invoke('storage:tabs:restore', String(id))) as {
      success: boolean
    }
    if (!success) {
      return false
    }
    await Promise.all([loadTrashed(), tabsStore.reloadFromDb()])
    return true
  }

  const forceDelete = async (id: number): Promise<boolean> => {
    const { success } = (await window.ipcRenderer.invoke('storage:tabs:force-delete', String(id))) as {
      success: boolean
    }
    if (!success) {
      return false
    }
    await Promise.all([loadTrashed(), tabsStore.reloadFromDb()])
    return true
  }

  return {
    trashedTabs,
    loading,
    loadTrashed,
    restore,
    forceDelete,
  }
})
