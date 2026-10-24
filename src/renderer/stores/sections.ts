import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { storage, repositoryStorageKeys } from '../storage'

// Sidebar sections, in display order. Individual folders are handled by
// the folders store; this store controls the enclosing folders section.
export type WorkspaceSection = 'pinned' | 'folders' | 'recent'

const validSections: WorkspaceSection[] = ['pinned', 'folders', 'recent']

export const useSectionsStore = defineStore('sections', () => {
  const collapsedSections: Ref<Set<WorkspaceSection>> = ref(new Set())

  const persistCollapsed = () => {
    void storage.set(repositoryStorageKeys.collapsedSections, [...collapsedSections.value])
  }

  const ready = storage
    .get<WorkspaceSection[]>(repositoryStorageKeys.collapsedSections)
    .then(storedCollapsedSections => {
      collapsedSections.value = new Set(
        (storedCollapsedSections ?? []).filter(section => validSections.includes(section))
      )
    })

  const isCollapsed = (section: WorkspaceSection): boolean => collapsedSections.value.has(section)

  const toggleSection = (section: WorkspaceSection) => {
    const next = new Set(collapsedSections.value)
    if (next.has(section)) {
      next.delete(section)
    } else {
      next.add(section)
    }
    collapsedSections.value = next
    persistCollapsed()
  }

  return {
    collapsedSections,
    ready,
    isCollapsed,
    toggleSection,
  }
})
