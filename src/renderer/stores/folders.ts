import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { WorkspaceFolder } from '../../types/workspace-folder.type'
import { storage, repositoryStorageKeys, toPlain } from '../storage'

export const useFoldersStore = defineStore('folders', () => {
  const folders: Ref<WorkspaceFolder[]> = ref([])
  const collapsedIds: Ref<Set<number>> = ref(new Set())

  const persistCollapsed = () => {
    void storage.set(repositoryStorageKeys.collapsedFolders, [...collapsedIds.value])
  }

  const ready = Promise.all([
    window.ipcRenderer.invoke('storage:folders:list') as Promise<WorkspaceFolder[]>,
    storage.get<number[]>(repositoryStorageKeys.collapsedFolders),
  ]).then(([storedFolders, storedCollapsedIds]) => {
    folders.value = storedFolders ?? []
    // prune ids of folders that no longer exist
    const existingIds = new Set(folders.value.map(folder => folder.id))
    collapsedIds.value = new Set((storedCollapsedIds ?? []).filter(id => existingIds.has(id)))
  })

  const isCollapsed = (id: number): boolean => collapsedIds.value.has(id)

  const toggleFolder = (id: number) => {
    const next = new Set(collapsedIds.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    collapsedIds.value = next
    persistCollapsed()
  }

  const collapseFolder = (id: number) => {
    if (collapsedIds.value.has(id)) {
      return
    }
    collapsedIds.value = new Set(collapsedIds.value).add(id)
    persistCollapsed()
  }

  const expandFolder = (id: number) => {
    if (!collapsedIds.value.has(id)) {
      return
    }
    const next = new Set(collapsedIds.value)
    next.delete(id)
    collapsedIds.value = next
    persistCollapsed()
  }

  const createFolder = async (name: string): Promise<WorkspaceFolder> => {
    const folder = (await window.ipcRenderer.invoke('storage:folders:create', name.trim())) as WorkspaceFolder
    folders.value.push(folder)
    return folder
  }

  const renameFolder = (id: number, name: string) => {
    const folder = folders.value.find(f => f.id === id)
    if (!folder || !name.trim()) {
      return
    }
    folder.name = name.trim()
    void window.ipcRenderer.invoke('storage:folders:update', toPlain(folder))
  }

  const deleteFolder = (id: number) => {
    folders.value = folders.value.filter(f => f.id !== id)
    if (collapsedIds.value.has(id)) {
      const next = new Set(collapsedIds.value)
      next.delete(id)
      collapsedIds.value = next
    }
    void window.ipcRenderer.invoke('storage:folders:delete', id)
  }

  const moveFolder = (folderId: number, index: number) => {
    const currentIndex = folders.value.findIndex(f => f.id === folderId)
    if (currentIndex === -1) {
      return
    }
    const [folder] = folders.value.splice(currentIndex, 1)
    folders.value.splice(Math.max(0, Math.min(index, folders.value.length)), 0, folder)
    void window.ipcRenderer.invoke(
      'storage:folders:reorder',
      folders.value.map(f => f.id)
    )
  }

  // Called by drag & drop with the full new folder order. Elements that are
  // not known folders (e.g. a workspace dropped between folders) are ignored.
  const setFoldersOrder = (ordered: WorkspaceFolder[]) => {
    const existingIds = new Set(folders.value.map(f => f.id))
    folders.value = ordered.filter(f => existingIds.has(f.id))
    void window.ipcRenderer.invoke(
      'storage:folders:reorder',
      folders.value.map(f => f.id)
    )
  }

  return {
    folders,
    collapsedIds,
    ready,
    isCollapsed,
    toggleFolder,
    collapseFolder,
    expandFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    setFoldersOrder,
  }
})
