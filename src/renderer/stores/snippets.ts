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

  const ready = window.ipcRenderer.invoke('storage:snippets:list').then((stored: Snippet[]) => {
    snippets.value = stored
  })

  const search = async (term: string): Promise<void> => {
    snippets.value = await window.ipcRenderer.invoke('storage:snippets:list', { search: term })
  }

  const add = async (snippet: Snippet): Promise<Snippet> => {
    const saved: Snippet = await window.ipcRenderer.invoke('storage:snippets:save', toPlain(snippet))
    const index = snippets.value.findIndex(s => s.id === saved.id)
    if (index !== -1) {
      snippets.value.splice(index, 1)
    }
    snippets.value.unshift(saved)
    return saved
  }

  const remove = async (id: string): Promise<void> => {
    const index = snippets.value.findIndex(s => s.id === id)
    if (index !== -1) {
      snippets.value.splice(index, 1)
      await window.ipcRenderer.invoke('storage:snippets:delete', id)
    }
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
