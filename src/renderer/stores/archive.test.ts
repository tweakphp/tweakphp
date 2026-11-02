import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useArchiveStore } from './archive'
import { ArchivedTab } from '../../types/tab.type'

const { invoke, reloadFromDb } = vi.hoisted(() => ({
  invoke: vi.fn(),
  reloadFromDb: vi.fn(),
}))

vi.stubGlobal('window', { ipcRenderer: { invoke, send: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() } })

vi.mock('./tabs', () => ({
  useTabsStore: () => ({ reloadFromDb }),
}))

const makeArchivedTab = (id: number, name: string): ArchivedTab =>
  ({
    id,
    name,
    type: 'code',
    code: '<?php\n',
    path: `/projects/${name}`,
    execution: 'local',
    result: [],
    queries: [],
    pane: { code: 50, result: 50 },
    info: { name: '', php_version: '', version: '' },
    folder_id: null,
    pinned: false,
    deleted_at: '2026-01-01T00:00:00.000Z',
  }) as ArchivedTab

describe('archive store', () => {
  let archiveStore: ReturnType<typeof useArchiveStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:list-trashed') {
        return Promise.resolve([makeArchivedTab(1, 'First'), makeArchivedTab(2, 'Second')])
      }
      if (channel === 'storage:tabs:restore' || channel === 'storage:tabs:force-delete') {
        return Promise.resolve({ success: true })
      }
      return Promise.resolve(undefined)
    })
    setActivePinia(createPinia())
    archiveStore = useArchiveStore()
  })

  it('loads the trashed tabs from the database', async () => {
    await archiveStore.loadTrashed()

    expect(invoke).toHaveBeenCalledWith('storage:tabs:list-trashed')
    expect(archiveStore.trashedTabs.map(t => t.id)).toEqual([1, 2])
    expect(archiveStore.loading).toBe(false)
  })

  it('restores a tab, reloads the trashed list and refreshes the tabs store', async () => {
    await archiveStore.loadTrashed()

    const result = await archiveStore.restore(1)

    expect(result).toBe(true)
    expect(invoke).toHaveBeenCalledWith('storage:tabs:restore', '1')
    expect(invoke).toHaveBeenCalledWith('storage:tabs:list-trashed')
    expect(reloadFromDb).toHaveBeenCalled()
  })

  it('returns false without reloading when the restore fails', async () => {
    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:restore') {
        return Promise.resolve({ success: false })
      }
      return Promise.resolve([])
    })

    const result = await archiveStore.restore(42)

    expect(result).toBe(false)
    expect(reloadFromDb).not.toHaveBeenCalled()
  })

  it('permanently deletes a tab and reloads both stores', async () => {
    await archiveStore.loadTrashed()

    const result = await archiveStore.forceDelete(2)

    expect(result).toBe(true)
    expect(invoke).toHaveBeenCalledWith('storage:tabs:force-delete', '2')
    expect(invoke).toHaveBeenCalledWith('storage:tabs:list-trashed')
    expect(reloadFromDb).toHaveBeenCalled()
  })

  it('returns false without reloading when the permanent delete fails', async () => {
    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:force-delete') {
        return Promise.resolve({ success: false })
      }
      return Promise.resolve([])
    })

    const result = await archiveStore.forceDelete(42)

    expect(result).toBe(false)
    expect(reloadFromDb).not.toHaveBeenCalled()
  })
})
