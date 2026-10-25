import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { Tab } from '../../types/tab.type'
import { useTabsStore } from './tabs'
import { useVaporStore } from './vapor'
import { useConnectionsStore } from './connections'

const { invoke, routerReplace } = vi.hoisted(() => ({
  invoke: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('../router', () => ({
  default: { replace: routerReplace },
}))

vi.mock('../themes', () => ({
  themeNames: [],
  themeColors: {},
}))

vi.stubGlobal('window', { ipcRenderer: { invoke, send: vi.fn(), on: vi.fn(), once: vi.fn(), removeListener: vi.fn() } })

const makeTab = (overrides: Partial<Tab> & { id: number }): Tab => ({
  name: `tab-${overrides.id}`,
  type: 'project',
  code: '<?php\n',
  path: `/tmp/${overrides.id}`,
  execution: 'local',
  result: [],
  queries: [],
  pane: { code: 50, result: 50 },
  info: { name: '', version: '', php_version: '' },
  folder_id: null,
  pinned: false,
  ...overrides,
})

const seedTabs = (store: ReturnType<typeof useTabsStore>, tabs: Tab[]) => {
  store.tabs.splice(0, store.tabs.length, ...tabs)
}

describe('tabs store', () => {
  let tabsStore: ReturnType<typeof useTabsStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:list' || channel === 'storage:connections:list') {
        return Promise.resolve([])
      }
      return Promise.resolve(undefined)
    })
    routerReplace.mockResolvedValue(undefined)
    setActivePinia(createPinia())
    tabsStore = useTabsStore()
    await tabsStore.ready
  })

  // ---- reloadFromDb (MCP push sync) ----

  it('reloadFromDb keeps the current tab editor code by default', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1, code: '<?php\n// local edits\n' })])
    tabsStore.setCurrent(tabsStore.tabs[0])

    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:list') {
        return Promise.resolve([makeTab({ id: 1, code: '<?php\n// from db\n' })])
      }
      return Promise.resolve(undefined)
    })

    await tabsStore.reloadFromDb()

    expect(tabsStore.current?.code).toBe('<?php\n// local edits\n')
  })

  it('reloadFromDb takes the db code when the MCP wrote code for the current tab', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1, code: '<?php\n// local edits\n' })])
    tabsStore.setCurrent(tabsStore.tabs[0])

    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:list') {
        return Promise.resolve([makeTab({ id: 1, code: '<?php\n// written by MCP\n' })])
      }
      return Promise.resolve(undefined)
    })

    await tabsStore.reloadFromDb({ codeUpdatedForTabId: 1 })

    expect(tabsStore.current?.code).toBe('<?php\n// written by MCP\n')
  })

  it('reloadFromDb switches the current project when requested', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1 }), makeTab({ id: 2 })])
    tabsStore.setCurrent(tabsStore.tabs[0])

    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:list') {
        return Promise.resolve([makeTab({ id: 1 }), makeTab({ id: 2 })])
      }
      return Promise.resolve(undefined)
    })

    await tabsStore.reloadFromDb({ currentProjectId: 2 })

    expect(tabsStore.current?.id).toBe(2)
  })

  it('reloadFromDb bumps the reloadVersion so views re-sync their local tab reference', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1 })])
    const before = tabsStore.reloadVersion

    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:tabs:list') {
        return Promise.resolve([makeTab({ id: 1 })])
      }
      return Promise.resolve(undefined)
    })

    await tabsStore.reloadFromDb()

    expect(tabsStore.reloadVersion).toBe(before + 1)
  })

  it('duplicateTab copies all the connections owned by the project (atomic ownership)', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1, execution: 'ssh', connection_id: '101' })])
    tabsStore.setCurrent(tabsStore.tabs[0])

    const connectionsStore = useConnectionsStore()
    invoke.mockImplementation((channel: string) => {
      if (channel === 'storage:connections:list') {
        return Promise.resolve([
          {
            id: '101',
            type: 'ssh',
            name: 'prod',
            host: '1.2.3.4',
            username: 'deploy',
            auth_type: 'password',
            path: '/var/www',
            tab_id: 1,
          },
          {
            id: '201',
            type: 'docker',
            name: 'app',
            container_name: 'app',
            working_directory: '/var/www/html',
            tab_id: 1,
          },
          {
            id: '301',
            type: 'ssh',
            name: 'foreign',
            host: '9.9.9.9',
            tab_id: 2,
          },
        ])
      }
      if (channel === 'storage:tabs:list') {
        return Promise.resolve([])
      }
      return Promise.resolve(undefined)
    })
    await connectionsStore.reload()

    const clone = await tabsStore.duplicateTab(1)

    expect(clone).not.toBeNull()
    // every owned connection is copied for the clone, never shared
    expect(invoke).toHaveBeenCalledWith(
      'storage:connections:save',
      expect.objectContaining({ type: 'ssh', host: '1.2.3.4', tab_id: clone!.id })
    )
    expect(invoke).toHaveBeenCalledWith(
      'storage:connections:save',
      expect.objectContaining({ type: 'docker', container_name: 'app', tab_id: clone!.id })
    )

    const savedPayloads = (invoke.mock.calls as any[][])
      .filter(([channel]) => channel === 'storage:connections:save')
      .map(([, payload]) => payload)
    // only the two owned connections: the foreign one is not copied
    expect(savedPayloads).toHaveLength(2)

    // the tab must exist in the DB before its connections (FK on connections.tab_id)
    const callIndexOf = (channel: string) => (invoke.mock.calls as any[][]).findIndex(([c]) => c === channel)
    const firstSaveAll = invoke.mock.invocationCallOrder[callIndexOf('storage:tabs:save-all')]
    const firstConnectionSave = invoke.mock.invocationCallOrder[callIndexOf('storage:connections:save')]
    expect(firstSaveAll).toBeLessThan(firstConnectionSave)

    // the clone's active connection maps to its own ssh copy
    const sshCopy = savedPayloads.find(payload => payload.type === 'ssh')
    expect(clone!.connection_id).toBe(String(sshCopy.id))
    expect(clone!.connection_id).not.toBe('101')
  })

  // ---- applyGroupOrder ----

  it('applyGroupOrder reorders a group and keeps the other groups untouched', () => {
    seedTabs(tabsStore, [makeTab({ id: 1 }), makeTab({ id: 2 }), makeTab({ id: 3, folder_id: 1 })])

    tabsStore.applyGroupOrder(null, [tabsStore.tabs[1], tabsStore.tabs[0]])

    expect(tabsStore.tabs.map(t => t.id)).toEqual([3, 2, 1])
    expect(tabsStore.tabs[1].folder_id).toBeNull()
    expect(tabsStore.tabs[2].folder_id).toBeNull()
    expect(invoke).toHaveBeenCalledWith('storage:tabs:save-all', expect.any(Array))
  })

  it('applyGroupOrder keeps hidden tabs at the end of the group (Show more slices)', () => {
    seedTabs(tabsStore, [
      makeTab({ id: 1 }),
      makeTab({ id: 3, folder_id: 1 }),
      makeTab({ id: 4, folder_id: 1 }),
      makeTab({ id: 5, folder_id: 1 }),
      makeTab({ id: 6, folder_id: 1 }),
    ])

    // visible slice reordered: [4, 3]; tabs 5 and 6 stay hidden (tail)
    tabsStore.applyGroupOrder(1, [tabsStore.tabs[2], tabsStore.tabs[1]])

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1, 4, 3, 5, 6])
    expect(tabsStore.tabs[1].folder_id).toBe(1)
    expect(tabsStore.tabs[2].folder_id).toBe(1)
  })

  it('applyGroupOrder ignores elements that are not known tabs (a folder dragged into a project list)', () => {
    seedTabs(tabsStore, [makeTab({ id: 1 }), makeTab({ id: 2, folder_id: 1 })])

    const draggedFolder = { id: 99, name: 'Folder', position: 0 } as unknown as Tab
    tabsStore.applyGroupOrder(1, [tabsStore.tabs[1], draggedFolder])

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1, 2])
    expect(invoke).toHaveBeenCalledWith('storage:tabs:save-all', expect.any(Array))
    const saved = invoke.mock.calls.find(call => call[0] === 'storage:tabs:save-all')![1] as Tab[]
    expect(saved.map(t => t.id)).toEqual([1, 2])
  })

  it('applyGroupOrder unpins tabs dropped into a folder or into Recent', () => {
    seedTabs(tabsStore, [makeTab({ id: 1, pinned: true }), makeTab({ id: 2, pinned: true, folder_id: 1 })])

    tabsStore.applyGroupOrder(1, [tabsStore.tabs[1]])

    expect(tabsStore.tabs[1].folder_id).toBe(1)
    expect(tabsStore.tabs[1].pinned).toBe(false)
    // the tab that stayed in the Pinned section keeps its pin
    expect(tabsStore.tabs[0].pinned).toBe(true)
  })

  // ---- applyPinnedOrder ----

  it('applyPinnedOrder reorders the pinned tabs and keeps the other tabs untouched', () => {
    seedTabs(tabsStore, [makeTab({ id: 1, pinned: true }), makeTab({ id: 2 }), makeTab({ id: 3, pinned: true })])

    tabsStore.applyPinnedOrder([tabsStore.tabs[2], tabsStore.tabs[0]])

    expect(tabsStore.tabs.map(t => t.id)).toEqual([3, 1, 2])
    expect(invoke).toHaveBeenCalledWith('storage:tabs:save-all', expect.any(Array))
  })

  it('applyPinnedOrder pins tabs dragged into the Pinned section and keeps their folder', () => {
    seedTabs(tabsStore, [makeTab({ id: 1, pinned: true }), makeTab({ id: 2, folder_id: 1 })])

    tabsStore.applyPinnedOrder([tabsStore.tabs[0], tabsStore.tabs[1]])

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1, 2])
    expect(tabsStore.tabs[1].pinned).toBe(true)
    expect(tabsStore.tabs[1].folder_id).toBe(1)
  })

  it('applyPinnedOrder ignores elements that are not known tabs', () => {
    seedTabs(tabsStore, [makeTab({ id: 1, pinned: true })])

    const draggedFolder = { id: 99, name: 'Folder', position: 0 } as unknown as Tab
    tabsStore.applyPinnedOrder([draggedFolder, tabsStore.tabs[0]])

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1])
    expect(invoke).toHaveBeenCalledWith('storage:tabs:save-all', expect.any(Array))
  })

  // ---- moveTab ----

  it('moveTab places the tab at the given position among the unpinned tabs of the group', () => {
    seedTabs(tabsStore, [
      makeTab({ id: 10, folder_id: 1, pinned: true }),
      makeTab({ id: 11, folder_id: 1 }),
      makeTab({ id: 12 }),
    ])

    tabsStore.moveTab(12, 1, 0)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([10, 12, 11])
    expect(tabsStore.tabs[1].folder_id).toBe(1)
  })

  it('moveTab appends at the end of the group when the index exceeds the displayed tabs', () => {
    seedTabs(tabsStore, [
      makeTab({ id: 10, folder_id: 1, pinned: true }),
      makeTab({ id: 11, folder_id: 1 }),
      makeTab({ id: 12 }),
      makeTab({ id: 13 }),
    ])

    tabsStore.moveTab(13, 1, 99)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([10, 11, 13, 12])
  })

  it('moveTab moves a tab to the top of the recent workspaces', () => {
    seedTabs(tabsStore, [makeTab({ id: 20, pinned: true }), makeTab({ id: 21 }), makeTab({ id: 22, folder_id: 1 })])

    tabsStore.moveTab(22, null, 0)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([20, 22, 21])
    expect(tabsStore.tabs[1].folder_id).toBeNull()
  })

  it('moveTab is a no-op for an unknown tab', () => {
    seedTabs(tabsStore, [makeTab({ id: 1 })])

    tabsStore.moveTab(999, null, 0)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1])
  })

  it('moveTab keeps a pinned tab pinned while changing its folder', () => {
    seedTabs(tabsStore, [makeTab({ id: 1, pinned: true }), makeTab({ id: 2, folder_id: 5 })])

    tabsStore.moveTab(1, 5, 0)

    expect(tabsStore.tabs[0].pinned).toBe(true)
    expect(tabsStore.tabs[0].folder_id).toBe(5)
  })

  // ---- duplicateTab ----

  it('duplicateTab clones the tab right after the original and activates it', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1, name: 'bar', code: '<?php echo 1;', folder_id: 1 })])
    tabsStore.current = tabsStore.tabs[0]

    const clone = await tabsStore.duplicateTab(1)

    expect(clone).not.toBeNull()
    expect(clone!.id).not.toBe(1)
    expect(clone!.name).toBe('bar')
    expect(clone!.code).toBe('<?php echo 1;')
    expect(clone!.folder_id).toBe(1)
    expect(tabsStore.tabs.map(t => t.id)).toEqual([1, clone!.id])
    expect(tabsStore.current?.id).toBe(clone!.id)
    expect(routerReplace).toHaveBeenCalledWith({ name: 'code', params: { id: clone!.id } })
  })

  it('duplicateTab copies the vapor connection config to the new tab id', async () => {
    const vaporStore = useVaporStore()
    seedTabs(tabsStore, [makeTab({ id: 2, execution: 'vapor' })])
    vaporStore.setEnvironment(2, 'production')

    const clone = await tabsStore.duplicateTab(2)

    expect(clone).not.toBeNull()
    expect(clone!.execution).toBe('vapor')
    expect(vaporStore.getConnectionConfig(clone!.id)?.environment).toBe('production')
    expect(vaporStore.getConnectionConfig(2)?.environment).toBe('production')
  })

  it('duplicateTab returns null for an unknown tab', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1 })])

    expect(await tabsStore.duplicateTab(999)).toBeNull()
  })

  // ---- removeFolderTabs ----

  it('removeFolderTabs removes every tab of the folder and redirects when the current tab is removed', async () => {
    const vaporStore = useVaporStore()
    seedTabs(tabsStore, [
      makeTab({ id: 1 }),
      makeTab({ id: 3, folder_id: 1 }),
      makeTab({ id: 4, folder_id: 1, execution: 'vapor' }),
    ])
    tabsStore.current = tabsStore.tabs[1]
    vaporStore.setEnvironment(4, 'production')

    await tabsStore.removeFolderTabs(1)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1])
    expect(tabsStore.current?.id).toBe(1)
    expect(routerReplace).toHaveBeenCalledWith({ name: 'code', params: { id: 1 } })
    // archiving keeps the vapor config so the project can be restored intact
    expect(vaporStore.getConnectionConfig(4)?.environment).toBe('production')
  })

  it('removeFolderTabs goes home when the removed folder held the last tabs', async () => {
    seedTabs(tabsStore, [makeTab({ id: 3, folder_id: 1 })])
    tabsStore.current = tabsStore.tabs[0]

    await tabsStore.removeFolderTabs(1)

    expect(tabsStore.tabs).toHaveLength(0)
    expect(tabsStore.current).toBeNull()
    expect(routerReplace).toHaveBeenCalledWith({ name: 'home' })
  })

  it('removeFolderTabs does not navigate when the current tab is not in the folder', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1 }), makeTab({ id: 3, folder_id: 1 })])
    tabsStore.current = tabsStore.tabs[0]
    routerReplace.mockClear()

    await tabsStore.removeFolderTabs(1)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1])
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('removeFolderTabs is a no-op for a folder without tabs', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1 })])

    expect(await tabsStore.removeFolderTabs(99)).toBeNull()
    expect(tabsStore.tabs.map(t => t.id)).toEqual([1])
  })

  // ---- removeTab ----

  it('removeTab archives the tab and keeps its vapor config for a restore', async () => {
    const vaporStore = useVaporStore()
    seedTabs(tabsStore, [makeTab({ id: 5, execution: 'vapor' }), makeTab({ id: 6 })])
    tabsStore.current = tabsStore.tabs[0]
    vaporStore.setEnvironment(5, 'production')

    await tabsStore.removeTab(5)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([6])
    expect(vaporStore.getConnectionConfig(5)?.environment).toBe('production')
  })

  it('removeTab is a no-op for an unknown tab', async () => {
    seedTabs(tabsStore, [makeTab({ id: 1 })])

    await tabsStore.removeTab(999)

    expect(tabsStore.tabs.map(t => t.id)).toEqual([1])
  })
})
