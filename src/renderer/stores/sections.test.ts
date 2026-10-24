import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSectionsStore } from './sections'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.stubGlobal('window', { ipcRenderer: { invoke, send: vi.fn() } })

describe('sections store', () => {
  let sectionsStore: ReturnType<typeof useSectionsStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    invoke.mockImplementation((channel: string, key: string) => {
      if (channel === 'storage:app:get' && key === 'renderer.collapsed-sections') {
        return Promise.resolve(['recent', 'bogus'])
      }
      return Promise.resolve(undefined)
    })
    setActivePinia(createPinia())
    sectionsStore = useSectionsStore()
    await sectionsStore.ready
  })

  it('loads collapsed sections and drops unknown values', () => {
    expect(sectionsStore.isCollapsed('pinned')).toBe(false)
    expect(sectionsStore.isCollapsed('folders')).toBe(false)
    expect(sectionsStore.isCollapsed('recent')).toBe(true)
  })

  it('toggles a section and persists the collapsed state', () => {
    sectionsStore.toggleSection('pinned')

    expect(sectionsStore.isCollapsed('pinned')).toBe(true)
    expect(invoke).toHaveBeenCalledWith('storage:app:set', 'renderer.collapsed-sections', ['recent', 'pinned'])

    sectionsStore.toggleSection('pinned')

    expect(sectionsStore.isCollapsed('pinned')).toBe(false)
    expect(invoke).toHaveBeenLastCalledWith('storage:app:set', 'renderer.collapsed-sections', ['recent'])
  })

  it('collapses the entire folders section independently of individual folders', () => {
    sectionsStore.toggleSection('folders')

    expect(sectionsStore.isCollapsed('folders')).toBe(true)
    expect(sectionsStore.isCollapsed('pinned')).toBe(false)
    expect(invoke).toHaveBeenCalledWith('storage:app:set', 'renderer.collapsed-sections', ['recent', 'folders'])
  })
})
