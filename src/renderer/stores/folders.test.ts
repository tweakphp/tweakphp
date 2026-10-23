import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFoldersStore } from './folders'
import { WorkspaceFolder } from '../../types/workspace-folder.type'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.stubGlobal('window', { ipcRenderer: { invoke, send: vi.fn() } })

const makeFolder = (id: number, name: string): WorkspaceFolder => ({
  id,
  name,
  position: id,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
})

describe('folders store', () => {
  let foldersStore: ReturnType<typeof useFoldersStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    invoke.mockImplementation((channel: string, key: string) => {
      if (channel === 'storage:folders:list') {
        return Promise.resolve([makeFolder(1, 'First'), makeFolder(2, 'Second')])
      }
      if (channel === 'storage:app:get' && key === 'renderer.collapsed-folders') {
        return Promise.resolve([2, 99])
      }
      if (channel === 'storage:folders:create') {
        return Promise.resolve(makeFolder(3, 'New folder'))
      }
      return Promise.resolve(undefined)
    })
    setActivePinia(createPinia())
    foldersStore = useFoldersStore()
    await foldersStore.ready
  })

  it('loads folders and prunes collapsed ids of folders that no longer exist', () => {
    expect(foldersStore.folders.map(f => f.id)).toEqual([1, 2])
    expect(foldersStore.isCollapsed(2)).toBe(true)
    expect(foldersStore.isCollapsed(99)).toBe(false)
  })

  it('toggles a folder and persists the collapsed state', () => {
    foldersStore.toggleFolder(1)

    expect(foldersStore.isCollapsed(1)).toBe(true)
    expect(invoke).toHaveBeenCalledWith('storage:app:set', 'renderer.collapsed-folders', [2, 1])

    foldersStore.toggleFolder(1)

    expect(foldersStore.isCollapsed(1)).toBe(false)
    expect(invoke).toHaveBeenLastCalledWith('storage:app:set', 'renderer.collapsed-folders', [2])
  })

  it('collapseFolder adds the id and persists, but is a no-op when already collapsed', () => {
    invoke.mockClear()
    foldersStore.collapseFolder(1)

    expect(foldersStore.isCollapsed(1)).toBe(true)
    expect(invoke).toHaveBeenCalledWith('storage:app:set', 'renderer.collapsed-folders', [2, 1])

    invoke.mockClear()
    foldersStore.collapseFolder(1)

    expect(invoke).not.toHaveBeenCalled()
  })

  it('expandFolder removes the id and persists, but is a no-op when not collapsed', () => {
    invoke.mockClear()
    foldersStore.expandFolder(2)

    expect(foldersStore.isCollapsed(2)).toBe(false)
    expect(invoke).toHaveBeenCalledWith('storage:app:set', 'renderer.collapsed-folders', [])

    invoke.mockClear()
    foldersStore.expandFolder(2)

    expect(invoke).not.toHaveBeenCalled()
  })

  it('deleteFolder also drops the folder from the collapsed state', () => {
    foldersStore.deleteFolder(2)

    expect(foldersStore.folders.map(f => f.id)).toEqual([1])
    expect(foldersStore.isCollapsed(2)).toBe(false)
    expect(invoke).toHaveBeenCalledWith('storage:folders:delete', 2)
  })

  it('createFolder pushes the created folder', async () => {
    const folder = await foldersStore.createFolder('New folder')

    expect(folder.id).toBe(3)
    expect(foldersStore.folders.map(f => f.id)).toEqual([1, 2, 3])
  })

  it('setFoldersOrder ignores elements that are not known folders (a project dropped between folders)', () => {
    const draggedTab = { id: 99, name: 'Project', position: 0 } as unknown as WorkspaceFolder

    foldersStore.setFoldersOrder([foldersStore.folders[1], draggedTab, foldersStore.folders[0]])

    expect(foldersStore.folders.map(f => f.id)).toEqual([2, 1])
    expect(invoke).toHaveBeenCalledWith('storage:folders:reorder', [2, 1])
  })
})
