import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVaporStore } from './vapor'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.stubGlobal('window', { ipcRenderer: { invoke, send: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() } })

describe('vapor store', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:connections:list') {
        return Promise.resolve([])
      }
      return Promise.resolve(undefined)
    })
    setActivePinia(createPinia())
  })

  it('persists a new vapor config with the owning tab id', async () => {
    const vaporStore = useVaporStore()
    await vaporStore.ready

    vaporStore.setEnvironment(77, 'production')

    expect(invoke).toHaveBeenCalledWith(
      'storage:connections:save',
      expect.objectContaining({ id: 77, type: 'vapor', environment: 'production', tab_id: 77 })
    )
  })

  it('keeps persisting the owning tab id for existing configs', async () => {
    const vaporStore = useVaporStore()
    await vaporStore.ready

    vaporStore.setEnvironment(77, 'production')
    vaporStore.setClientPath(77, '/usr/local/bin/vapor')

    expect(invoke).toHaveBeenLastCalledWith(
      'storage:connections:save',
      expect.objectContaining({ id: 77, tab_id: 77, client_path: '/usr/local/bin/vapor', name: 'vapor-77' })
    )
  })
})
