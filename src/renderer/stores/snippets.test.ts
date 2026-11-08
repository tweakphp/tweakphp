import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSnippetsStore } from './snippets'
import type { Snippet } from '../../types/snippet.type'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.stubGlobal('window', { ipcRenderer: { invoke } })

const first: Snippet = { id: '1', title: 'First', code: 'first()' }
const second: Snippet = { id: '2', title: 'Second', code: 'second()' }

describe('snippets store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    invoke.mockImplementation((channel: string, payload?: { search?: string }) => {
      if (channel === 'storage:snippets:list') {
        return Promise.resolve(payload?.search === 'first' ? [first] : [first, second])
      }
      if (channel === 'storage:snippets:save') return Promise.resolve(second)
      if (channel === 'storage:snippets:delete') return Promise.resolve({ success: true })
      return Promise.resolve()
    })
  })

  it('refreshes the active search after saving and deleting', async () => {
    const store = useSnippetsStore()
    await store.ready
    await store.search('first')
    await store.add(second)
    expect(store.snippets).toEqual([first])
    await store.remove('2')
    expect(invoke).toHaveBeenLastCalledWith('storage:snippets:list', { search: 'first' })
    expect(store.snippets).toEqual([first])
  })

  it('reports refresh errors without treating a successful save as failed', async () => {
    const store = useSnippetsStore()
    await store.ready
    invoke.mockImplementation((channel: string) =>
      channel === 'storage:snippets:save' ? Promise.resolve(second) : Promise.reject(new Error('offline'))
    )
    await expect(store.add(second)).resolves.toEqual(second)
    expect(store.searchError).toContain('Could not load')
    expect(store.loading).toBe(false)
  })

  it('ignores stale results and errors, including during debounce', async () => {
    const store = useSnippetsStore()
    await store.ready
    let rejectOld!: (error: Error) => void
    invoke.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectOld = reject)))
    const old = store.search('old').catch(() => {})
    store.setSearchTerm('first')
    rejectOld(new Error('old failure'))
    await old
    expect(store.loading).toBe(true)
    expect(store.searchError).toBe('')
    await store.search('first')
    expect(store.snippets).toEqual([first])
    expect(store.loading).toBe(false)
  })

  it('keeps the newest results when searches complete out of order', async () => {
    const store = useSnippetsStore()
    await store.ready
    let resolveOld!: (snippets: Snippet[]) => void
    invoke.mockImplementationOnce(() => new Promise(resolve => (resolveOld = resolve)))
    const old = store.search('old')
    await store.search('first')
    resolveOld([second])
    await old
    expect(store.snippets).toEqual([first])
    expect(store.searchTerm).toBe('first')
  })

  it('rejects a failed delete without refreshing the list', async () => {
    const store = useSnippetsStore()
    await store.ready
    invoke.mockResolvedValueOnce({ success: false })
    await expect(store.remove('missing')).rejects.toThrow('Snippet not found')
    expect(store.snippets).toEqual([first, second])
    expect(invoke).toHaveBeenLastCalledWith('storage:snippets:delete', 'missing')
  })

  it('keeps the cursor associated with its tab', async () => {
    const store = useSnippetsStore()
    await store.ready
    store.setLastCursor(1, { lineNumber: 2, column: 3 })
    store.requestInsert(1, 'code', 'insert')
    expect(store.pendingInsert?.position).toEqual({ lineNumber: 2, column: 3 })
    store.requestInsert(2, 'code', 'insert')
    expect(store.pendingInsert?.position).toBeNull()
    store.requestInsert(1, 'code', 'replace')
    expect(store.pendingInsert?.position).toBeNull()
  })
})
