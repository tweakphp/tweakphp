import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { clampSidebarWidth, DEFAULT_SIDEBAR_WIDTH, sidebarWidthBounds, useSidebarWidthStore } from './sidebar-width'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.stubGlobal('window', { ipcRenderer: { invoke } })

describe('sidebar width', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('restores the preferred width and persists it only on request', async () => {
    invoke.mockResolvedValueOnce(360)
    const store = useSidebarWidthStore()
    await store.ready

    expect(store.width).toBe(360)
    store.setWidth(400)
    expect(invoke).toHaveBeenCalledTimes(1)

    await store.persistWidth()
    expect(invoke).toHaveBeenCalledWith('storage:app:set', 'renderer.sidebar-width', 400)
  })

  it('uses the default for missing or invalid saved values', async () => {
    invoke.mockResolvedValueOnce('not a width')
    const store = useSidebarWidthStore()
    await store.ready

    expect(store.width).toBe(DEFAULT_SIDEBAR_WIDTH)
    store.setWidth(Number.NaN)
    expect(store.width).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it('keeps widths within the configured bounds', async () => {
    invoke.mockResolvedValueOnce(9999)
    const store = useSidebarWidthStore()
    await store.ready

    expect(store.width).toBe(480)
    store.setWidth(0)
    expect(store.width).toBe(192)
  })

  it('leaves room for content when the window shrinks without changing the preference', async () => {
    invoke.mockResolvedValueOnce(400)
    const store = useSidebarWidthStore()
    await store.ready

    expect(clampSidebarWidth(store.width, 600)).toBe(280)
    expect(clampSidebarWidth(store.width, 1100)).toBe(400)
    expect(clampSidebarWidth(100, 1100)).toBe(192)
    expect(sidebarWidthBounds(450)).toEqual({ min: 130, max: 130 })
    expect(store.width).toBe(400)
  })
})
