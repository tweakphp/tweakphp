import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import events from '../events'
import { initExecutionEvents, prepareExecution } from './execution-events'
import { useExecuteStore } from './execute'
import { useTabsStore } from './tabs'
import { joinResultOutputs, visibleResults } from '../utils/output'
import { Tab } from '../../types/tab.type'

const { routerMock } = vi.hoisted(() => ({
  routerMock: { replace: vi.fn(), push: vi.fn() },
}))

vi.mock('../router', () => ({
  default: routerMock,
}))

vi.mock('../themes', () => ({
  themeNames: [],
  themeColors: {},
}))

const makeTab = (overrides: Partial<Tab> & { id: number }): Tab =>
  ({
    name: `tab-${overrides.id}`,
    type: 'code',
    code: '<?php\n',
    path: `/tmp/${overrides.id}`,
    execution: 'local',
    result: [],
    queries: [],
    pane: { code: 50, result: 50 },
    info: { name: '', version: '', php_version: '' },
    ...overrides,
  }) as Tab

const seedTabs = (tabsStore: ReturnType<typeof useTabsStore>, tabs: Tab[]) => {
  tabsStore.tabs.splice(0, tabsStore.tabs.length, ...tabs)
}

const streamEvent = (tabId: number, event: unknown) =>
  events.dispatchEvent(new CustomEvent('client.execute.stream', { detail: { tabId, event } }))

const replyEvent = (detail: unknown) => events.dispatchEvent(new CustomEvent('client.execute.reply', { detail }))

const start = (tabId: number, streaming: boolean) => {
  prepareExecution(tabId, streaming)
  useExecuteStore().startExecution(tabId)
}

describe('execution-events router', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).window = {
      ipcRenderer: {
        invoke: vi.fn(async () => []),
        send: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
      },
    }
    initExecutionEvents()
  })

  it('with streaming display OFF, stages stream events and flushes them on streamingDone', () => {
    const tabsStore = useTabsStore()
    const executeStore = useExecuteStore()
    seedTabs(tabsStore, [makeTab({ id: 5, result: [{ line: 0, code: 'old', output: 'previous output', html: '' }] })])
    const updateTabSpy = vi.spyOn(tabsStore, 'updateTab')

    start(5, false)
    const updateTabCalls = updateTabSpy.mock.calls.length

    streamEvent(5, { type: 'started' })
    streamEvent(5, { type: 'statement.started', index: 0, line: 1, code: 'echo 1;' })
    streamEvent(5, { type: 'output', index: 0, data: '1' })

    // nothing is applied to the tab while the execution runs: previous output stays visible
    expect(tabsStore.findTab(5)!.result).toHaveLength(1)
    expect(tabsStore.findTab(5)!.result[0].output).toBe('previous output')
    expect(updateTabSpy.mock.calls.length).toBe(updateTabCalls)

    replyEvent({ tabId: 5, streamingDone: true })

    expect(tabsStore.findTab(5)!.result).toHaveLength(1)
    expect(tabsStore.findTab(5)!.result[0]).toMatchObject({ line: 1, code: 'echo 1;', output: '1' })
    expect(executeStore.isExecuting(5)).toBe(false)
    expect(updateTabSpy.mock.calls.length).toBeGreaterThan(updateTabCalls)
  })

  it('with streaming display OFF, ignores events of other tabs', () => {
    const tabsStore = useTabsStore()
    const executeStore = useExecuteStore()
    seedTabs(tabsStore, [makeTab({ id: 5 }), makeTab({ id: 6 })])

    start(5, false)
    streamEvent(6, { type: 'output', index: 0, data: 'other tab' })
    replyEvent({ tabId: 5, streamingDone: true })

    // the other tab's output never lands here: the flush applies the (empty) staged run
    expect(tabsStore.findTab(5)!.result).toHaveLength(0)
    expect(executeStore.isExecuting(6)).toBe(false)
  })

  it('with streaming display ON, applies stream events incrementally', () => {
    const tabsStore = useTabsStore()
    const executeStore = useExecuteStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, true)

    expect(tabsStore.findTab(5)!.result).toEqual([])
    streamEvent(5, { type: 'started' })
    streamEvent(5, { type: 'statement.started', index: 0, line: 1, code: 'echo 1;' })
    streamEvent(5, { type: 'output', index: 0, data: '1' })

    expect(tabsStore.findTab(5)!.result).toHaveLength(1)
    expect(tabsStore.findTab(5)!.result[0].output).toBe('1')

    replyEvent({ tabId: 5, streamingDone: true })

    expect(executeStore.isExecuting(5)).toBe(false)
  })

  it('applies the buffered result on a terminal non-streaming reply', () => {
    const tabsStore = useTabsStore()
    const executeStore = useExecuteStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, false)
    replyEvent({ tabId: 5, output: [{ line: 1, code: 'echo 1;', output: '1', html: '' }] })

    expect(tabsStore.findTab(5)!.result).toHaveLength(1)
    expect(tabsStore.findTab(5)!.result[0].output).toBe('1')
    expect(executeStore.isExecuting(5)).toBe(false)
  })

  it('parses a TWEAKPHP_ERROR string reply into a structured error result', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, false)
    replyEvent({ tabId: 5, output: 'TWEAKPHP_ERROR:PHP Fatal error: something bad on line 7' })

    const result = tabsStore.findTab(5)!.result[0]
    expect(result.line).toBe(7)
    expect(result.output).toContain('PHP Fatal error')
    expect(tabsStore.findTab(5)!.queries).toEqual([])
  })

  it('applies staged results before a terminal error reply, then ignores late streamingDone', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, false)
    streamEvent(5, { type: 'output', index: 0, data: 'partial' })
    replyEvent({ tabId: 5, error: new Error('boom') })

    // the staged partial output of the current run is applied first, then the error is appended
    const results = tabsStore.findTab(5)!.result
    expect(results).toHaveLength(2)
    expect(results[0].output).toBe('partial')
    expect(results[1].output).toBe('boom')

    // a late streamingDone (e.g. orphan stop) must not change anything anymore
    replyEvent({ tabId: 5, streamingDone: true })
    expect(tabsStore.findTab(5)!.result).toHaveLength(2)
    expect(tabsStore.findTab(5)!.result[0].output).toBe('partial')
  })

  it('runs multiple tabs concurrently and ends each independently', () => {
    const tabsStore = useTabsStore()
    const executeStore = useExecuteStore()
    seedTabs(tabsStore, [makeTab({ id: 5 }), makeTab({ id: 6 })])

    start(5, true)
    start(6, true)

    streamEvent(5, { type: 'output', index: 0, data: 'from-5' })
    streamEvent(6, { type: 'output', index: 0, data: 'from-6' })

    expect(tabsStore.findTab(5)!.result[0].output).toBe('from-5')
    expect(tabsStore.findTab(6)!.result[0].output).toBe('from-6')
    expect(executeStore.isExecuting(5)).toBe(true)
    expect(executeStore.isExecuting(6)).toBe(true)

    replyEvent({ tabId: 5, streamingDone: true })

    expect(executeStore.isExecuting(5)).toBe(false)
    expect(executeStore.isExecuting(6)).toBe(true)

    replyEvent({ tabId: 6, streamingDone: true })

    expect(executeStore.isExecuting(6)).toBe(false)
  })

  it('keeps streaming a background tab while another tab view is open', () => {
    const tabsStore = useTabsStore()
    const executeStore = useExecuteStore()
    seedTabs(tabsStore, [makeTab({ id: 5 }), makeTab({ id: 6 })])

    start(5, true)
    // the user switched to tab 6 and runs it while tab 5 streams in background
    start(6, true)
    streamEvent(6, { type: 'output', index: 0, data: 'foreground' })
    streamEvent(5, { type: 'output', index: 0, data: 'background' })

    expect(tabsStore.findTab(5)!.result[0].output).toBe('background')
    expect(tabsStore.findTab(6)!.result[0].output).toBe('foreground')
    expect(executeStore.isExecuting(5)).toBe(true)
  })

  it('cleans up when the reply arrives for a tab that no longer exists', () => {
    const executeStore = useExecuteStore()

    start(42, true)
    seedTabs(useTabsStore(), []) // tab archived/closed while running

    replyEvent({ tabId: 42, streamingDone: true })

    expect(executeStore.isExecuting(42)).toBe(false)
  })

  it('drops stream events for runs it did not start', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 7, result: [{ line: 0, code: 'old', output: 'previous', html: '' }] })])

    streamEvent(7, { type: 'output', index: 0, data: 'orphan' })

    expect(tabsStore.findTab(7)!.result).toHaveLength(1)
    expect(tabsStore.findTab(7)!.result[0].output).toBe('previous')
  })

  it('normalizes vapor output on the buffered reply', () => {
    const tabsStore = useTabsStore()
    const tab = makeTab({ id: 8, execution: 'vapor' })
    seedTabs(tabsStore, [tab])
    ;(tabsStore as any).getConnectionConfig = vi.fn(() => ({ type: 'vapor' }))

    start(8, false)
    replyEvent({ tabId: 8, output: 'plain vapor output' })

    expect(tabsStore.findTab(8)!.result[0].output).toBe('plain vapor output')
  })

  it('separates the print return value from its explicit output and HTML', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, true)
    streamEvent(5, { type: 'statement.started', index: 0, line: 8, code: 'print $user->email;' })
    streamEvent(5, { type: 'output', index: 0, data: 'feil.noel@' })
    streamEvent(5, { type: 'output', index: 0, data: 'example.com' })
    streamEvent(5, { type: 'output', index: 0, data: '1', html: '<pre>1</pre>', implicit: true })
    streamEvent(5, { type: 'statement.completed', index: 0, implicit: false })

    const results = tabsStore.findTab(5)!.result
    expect(joinResultOutputs(visibleResults(results, 'explicit'))).toBe('feil.noel@example.com')
    expect(visibleResults(results, 'explicit')[0]).toMatchObject({
      output: 'feil.noel@example.com',
      html: '',
      htmlReady: true,
    })
    expect(visibleResults(results, 'all')[0]).toMatchObject({
      output: 'feil.noel@example.com1',
      html: '<pre>1</pre>',
      parts: [
        { output: 'feil.noel@example.com', html: '', implicit: false },
        { output: '1', html: '<pre>1</pre>', implicit: true },
      ],
    })
    expect(visibleResults(results, 'explicit')[0].parts).toEqual([
      { output: 'feil.noel@example.com', html: '', implicit: false },
    ])
  })

  it('preserves an explicitly printed 1 instead of stripping output by its value', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, true)
    streamEvent(5, { type: 'statement.started', index: 0, line: 1, code: 'print 1;' })
    streamEvent(5, { type: 'output', index: 0, data: '1' })
    streamEvent(5, { type: 'output', index: 0, data: '1', implicit: true })
    streamEvent(5, { type: 'statement.completed', index: 0, implicit: false })

    const results = tabsStore.findTab(5)!.result
    expect(joinResultOutputs(visibleResults(results, 'explicit'))).toBe('1')
  })

  it('preserves explicit dumps and hides only their implicit return HTML', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, true)
    streamEvent(5, { type: 'statement.started', index: 0, line: 1, code: 'print_r([1]);' })
    streamEvent(5, { type: 'output', index: 0, data: 'Array (1)', html: '<pre>Array (1)</pre>' })
    streamEvent(5, { type: 'output', index: 0, data: 'true', html: '<pre>true</pre>', implicit: true })
    streamEvent(5, { type: 'statement.completed', index: 0, implicit: false })

    const results = tabsStore.findTab(5)!.result
    expect(joinResultOutputs(visibleResults(results, 'explicit'))).toBe('Array (1)')
    expect(visibleResults(results, 'explicit')[0].html).toBe('<pre>Array (1)</pre>')
  })

  it('hides implicit-only output throughout streaming, retaining it for Full stack', () => {
    const tabsStore = useTabsStore()
    seedTabs(tabsStore, [makeTab({ id: 5 })])

    start(5, true)
    streamEvent(5, { type: 'statement.started', index: 0, line: 1, code: '$user = User::first();' })
    streamEvent(5, { type: 'output', index: 0, data: 'User {...}', html: '<pre>User {...}</pre>', implicit: true })
    expect(joinResultOutputs(visibleResults(tabsStore.findTab(5)!.result, 'explicit'))).toBe('')
    streamEvent(5, { type: 'statement.completed', index: 0, implicit: true })

    const results = tabsStore.findTab(5)!.result
    expect(joinResultOutputs(visibleResults(results, 'explicit'))).toBe('')
    expect(visibleResults(results, 'all')[0].output).toBe('User {...}')
  })
})
