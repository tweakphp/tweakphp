import { Ref, ref } from 'vue'
import { defineStore } from 'pinia'
import { Snippet } from '../../types/snippet.type'
import { toPlain } from '../storage'

export interface SnippetCursor {
  lineNumber: number
  column: number
}

export interface PendingSnippetInsert {
  tabId: number
  code: string
  mode: 'insert' | 'replace'
  position: SnippetCursor | null
}

export const useSnippetsStore = defineStore('snippets', () => {
  const snippets: Ref<Snippet[]> = ref([])
  const pendingInsert: Ref<PendingSnippetInsert | null> = ref(null)
  const lastCursor: Ref<{ tabId: number; position: SnippetCursor } | null> = ref(null)
  const searchTerm = ref('')
  const loading = ref(false)
  const searchError = ref('')

  let listVersion = 0
  const setSearchTerm = (term: string) => {
    searchTerm.value = term
    listVersion++
    loading.value = true
    searchError.value = ''
  }

  const search = async (term: string): Promise<void> => {
    searchTerm.value = term
    const version = ++listVersion
    loading.value = true
    searchError.value = ''
    try {
      const results = await window.ipcRenderer.invoke('storage:snippets:list', { search: term })
      if (version === listVersion) snippets.value = results
    } catch (error) {
      if (version === listVersion) searchError.value = 'Could not load snippets. Please try again.'
      throw error
    } finally {
      if (version === listVersion) loading.value = false
    }
  }

  const ready = search('')
  // The store can be created before a snippets UI is mounted.
  void ready.catch(() => {})

  const refreshAfterMutation = async () => {
    // A failed refresh must not make a successful save/delete look unsuccessful.
    try {
      await search(searchTerm.value)
    } catch {
      // searchError exposes the refresh failure separately.
    }
  }

  const add = async (snippet: Snippet): Promise<Snippet> => {
    const saved: Snippet = await window.ipcRenderer.invoke('storage:snippets:save', toPlain(snippet))
    await refreshAfterMutation()
    return saved
  }

  const remove = async (id: string): Promise<void> => {
    const result = await window.ipcRenderer.invoke('storage:snippets:delete', id)
    if (!result.success) throw new Error('Snippet not found')
    await refreshAfterMutation()
  }

  const setLastCursor = (tabId: number, position: SnippetCursor | null) => {
    if (!position) {
      return
    }
    lastCursor.value = { tabId, position }
  }

  const requestInsert = (tabId: number, code: string, mode: 'insert' | 'replace') => {
    const position = mode === 'insert' && lastCursor.value?.tabId === tabId ? lastCursor.value.position : null
    pendingInsert.value = { tabId, code, mode, position }
  }

  const consumePendingInsert = (): PendingSnippetInsert | null => {
    const pending = pendingInsert.value
    pendingInsert.value = null
    return pending
  }

  return {
    snippets,
    ready,
    searchTerm,
    loading,
    searchError,
    setSearchTerm,
    search,
    add,
    remove,
    pendingInsert,
    lastCursor,
    setLastCursor,
    requestInsert,
    consumePendingInsert,
  }
})
