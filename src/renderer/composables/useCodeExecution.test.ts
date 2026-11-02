import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, type Ref } from 'vue'
import { useCodeExecution } from './useCodeExecution'
import type { Tab } from '../../types/tab.type'

const { prepareExecutionMock } = vi.hoisted(() => ({
  prepareExecutionMock: vi.fn(),
}))

vi.mock('../stores/execution-events', () => ({
  prepareExecution: prepareExecutionMock,
}))

const createTab = (): Tab =>
  ({
    id: 5,
    type: 'code',
    name: 'tab',
    code: 'echo 1;',
    path: '/app',
    execution: 'local',
    result: [{ line: 0, code: 'old', output: 'previous output', html: '' }],
    queries: [],
    pane: { code: 50, result: 50 },
    info: { name: '', php_version: '', version: '' },
  }) as unknown as Tab

const setup = (streamingDisplay: boolean) => {
  const tab = ref<Tab>(createTab())
  const settingsStore = { settings: { streaming: streamingDisplay } }
  const executeStore = {
    isExecuting: vi.fn(() => false),
    startExecution: vi.fn(),
  }
  const tabsStore = {
    getConnectionConfig: vi.fn(() => ({ type: 'local' })),
  }
  const loadersStore = { get: vi.fn(() => undefined) }

  const composable = useCodeExecution({
    tab,
    settingsStore,
    executeStore,
    tabsStore,
    loadersStore,
  } as any)

  return { tab, composable, executeStore, tabsStore }
}

const setupWithEditor = (codeEditor: Ref<{ getSelectedText: () => string }>) => {
  const tab = ref<Tab>(createTab())

  const composable = useCodeExecution({
    tab,
    codeEditor,
    settingsStore: { settings: { streaming: true } },
    executeStore: { isExecuting: vi.fn(() => false), startExecution: vi.fn() },
    tabsStore: { getConnectionConfig: vi.fn(() => ({ type: 'local' })) },
    loadersStore: { get: vi.fn(() => undefined) },
  } as any)

  return { composable }
}

describe('useCodeExecution', () => {
  beforeEach(() => {
    ;(globalThis as any).window = { ipcRenderer: { send: vi.fn() } }
    prepareExecutionMock.mockClear()
  })

  it('sends the run payload with the tab id and marks the tab as executing', () => {
    const { tab, composable, executeStore } = setup(true)

    composable.executeHandler()

    expect(prepareExecutionMock).toHaveBeenCalledWith(5, true)
    expect(executeStore.startExecution).toHaveBeenCalledWith(5)
    expect(window.ipcRenderer.send).toHaveBeenCalledWith('client.execute', {
      connection: { type: 'local' },
      code: tab.value.code,
      loader: '',
      tabId: 5,
      streaming: true,
    })
  })

  it('seeds the per-run state with the streaming display mode', () => {
    const { composable } = setup(false)

    composable.executeHandler()

    expect(prepareExecutionMock).toHaveBeenCalledWith(5, false)
  })

  it('ignores a run request while this tab is already executing', () => {
    const { composable, executeStore } = setup(false)
    ;(executeStore.isExecuting as any).mockReturnValue(true)

    composable.executeHandler()

    expect(window.ipcRenderer.send).not.toHaveBeenCalled()
    expect(executeStore.startExecution).not.toHaveBeenCalled()
    expect(prepareExecutionMock).not.toHaveBeenCalled()
  })

  it('allows a run on a tab while another tab is executing', () => {
    const { composable, executeStore } = setup(true)
    // the store only reports executions of other tabs as busy
    ;(executeStore.isExecuting as any).mockImplementation((tabId: number) => tabId !== 5)

    composable.executeHandler()

    expect(window.ipcRenderer.send).toHaveBeenCalledWith(
      'client.execute',
      expect.objectContaining({ tabId: 5, streaming: true })
    )
  })

  it('sends the stop request for its own tab', () => {
    const { composable } = setup(false)

    composable.stopHandler()

    expect(window.ipcRenderer.send).toHaveBeenCalledWith('client.execute.stop', { tabId: 5 })
  })

  it('uses the selected code when the editor has a selection', () => {
    const codeEditor = ref<{ getSelectedText: () => string }>({ getSelectedText: () => 'echo 2;' })

    const { composable } = setupWithEditor(codeEditor)

    composable.executeHandler()

    expect((window.ipcRenderer.send as any).mock.calls.at(-1)[1]).toMatchObject({ code: 'echo 2;' })
  })
})
