import { parseTweakPhpError } from '../../shared/tweakphp-error'
import type { Result, Tab } from '../../types/tab.type'
import type { ConnectionConfig as DockerConnectionConfig } from '../../types/docker.type'
import type { ConnectionConfig as KubectlConnectionConfig } from '../../types/kubectl.type'
import type { ConnectionConfig as LocalConnectionConfig } from '../../types/local.type'
import type { ConnectionConfig as SSHConnectionConfig } from '../../types/ssh.type'
import type { ConnectionConfig as VaporConnectionConfig } from '../../types/vapor.type'
import { normalizeVaporOutput, stripAnsi } from '../utils/output'
import events from '../events'
import { useExecuteStore } from './execute'
import { useTabsStore } from './tabs'

type ConnectionConfig =
  LocalConnectionConfig | SSHConnectionConfig | VaporConnectionConfig | DockerConnectionConfig | KubectlConnectionConfig

interface ExecutionRunState {
  receivedStreamOutput: boolean
  stagedResults: Result[] | null
}

interface RecordValue {
  [key: string]: unknown
}

interface DetailEvent extends Event {
  detail: unknown
}

type StreamEvent =
  | { type: 'started' }
  | { type: 'statement.started'; index: number; line: number; code: string }
  | { type: 'output'; index?: number; data: string; html?: string }
  | { type: 'statement.completed'; index?: number; queries?: unknown[]; query_errors?: unknown[]; html?: string }
  | { type: 'error'; error?: unknown }

type ResultPayload = Omit<Result, 'html'> & { html?: string }

const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null

const isDetailEvent = (event: Event): event is DetailEvent => 'detail' in event

const isResultPayload = (value: unknown): value is ResultPayload =>
  isRecord(value) &&
  typeof value.line === 'number' &&
  typeof value.code === 'string' &&
  typeof value.output === 'string' &&
  (value.html === undefined || typeof value.html === 'string')

const parseResults = (value: unknown): Result[] | null => {
  if (!Array.isArray(value) || !value.every(isResultPayload)) return null

  return value.map(result => ({
    ...result,
    output: stripAnsi(result.output),
    html: result.html ?? '',
  }))
}

const parseStreamEvent = (value: unknown): StreamEvent | null => {
  if (!isRecord(value) || typeof value.type !== 'string') return null

  switch (value.type) {
    case 'started':
      return { type: 'started' }
    case 'statement.started':
      if (typeof value.index !== 'number' || typeof value.line !== 'number' || typeof value.code !== 'string')
        return null
      return { type: 'statement.started', index: value.index, line: value.line, code: value.code }
    case 'output':
      if (typeof value.data !== 'string') return null
      return {
        type: 'output',
        index: typeof value.index === 'number' ? value.index : undefined,
        data: value.data,
        html: typeof value.html === 'string' ? value.html : undefined,
      }
    case 'statement.completed':
      return {
        type: 'statement.completed',
        index: typeof value.index === 'number' ? value.index : undefined,
        queries: Array.isArray(value.queries) ? value.queries : undefined,
        query_errors: Array.isArray(value.query_errors) ? value.query_errors : undefined,
        html: typeof value.html === 'string' ? value.html : undefined,
      }
    case 'error':
      return { type: 'error', error: value.error }
    default:
      return null
  }
}

const stringifyReply = (value: unknown): string => {
  if (typeof value === 'string') return stripAnsi(value)
  if (value instanceof Error) return value.message

  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

// Per-tab bookkeeping of the run in flight: stream events land here while the
// execution streams, and staged (display OFF) results are kept out of the tab
// until the run ends.
const runs = new Map<number, ExecutionRunState>()

const getRun = (tabId: number): ExecutionRunState | undefined => runs.get(tabId)

const syncTabQueries = (tab: Tab) => {
  tab.queries = tab.result.flatMap(result => (Array.isArray(result.queries) ? result.queries : []))
}

const flushStagedResults = (tab: Tab, tabId: number) => {
  const run = getRun(tabId)
  if (!run || !run.stagedResults) return
  tab.result = run.stagedResults
  run.stagedResults = null
  syncTabQueries(tab)
  useTabsStore().updateTab(tab)
}

// Called by the composable when a run starts (before the IPC send): it seeds
// the per-run state and resets the tab output according to the display mode.
export const prepareExecution = (tabId: number, streaming: boolean) => {
  const tabsStore = useTabsStore()
  runs.set(tabId, {
    receivedStreamOutput: false,
    stagedResults: streaming ? null : [],
  })

  const tab = tabsStore.findTab(tabId)
  if (!tab) return

  tab.queries = []
  if (streaming) {
    tab.result = []
  }
  tabsStore.updateTab(tab)
}

const handleExecuteStream = (event: Event) => {
  const detail = isDetailEvent(event) && isRecord(event.detail) ? event.detail : null
  if (!detail || typeof detail.tabId !== 'number') return

  const streamEvent = parseStreamEvent(detail.event)
  if (!streamEvent) return

  const tabsStore = useTabsStore()
  const tab = tabsStore.findTab(detail.tabId)
  const run = getRun(detail.tabId)
  if (!tab || !run) return

  const results = run.stagedResults ?? tab.result

  if (streamEvent.type === 'started') {
    if (run.stagedResults) {
      run.stagedResults = []
    } else {
      tab.result = []
      tab.queries = []
    }
    return
  }

  if (streamEvent.type === 'statement.started') {
    const exists = results.some((_result, index) => index === streamEvent.index)
    if (!exists) {
      results.push({
        line: streamEvent.line,
        code: streamEvent.code,
        output: '',
        html: '',
        htmlReady: false,
        queries: [],
        query_errors: [],
      })
    }
  } else if (streamEvent.type === 'output') {
    run.receivedStreamOutput = true
    const index = streamEvent.index ?? 0
    if (!results[index]) {
      results[index] = {
        line: 0,
        code: '',
        output: '',
        html: '',
        htmlReady: false,
        queries: [],
      }
    }

    results[index].output += stripAnsi(streamEvent.data)
    if (streamEvent.html !== undefined) {
      results[index].html += streamEvent.html
    }
  } else if (streamEvent.type === 'statement.completed') {
    const index = streamEvent.index ?? 0
    const result = results[index]

    if (result) {
      if (streamEvent.queries) result.queries = streamEvent.queries
      if (streamEvent.query_errors) result.query_errors = streamEvent.query_errors
      if (streamEvent.html !== undefined && !result.html) result.html = streamEvent.html
      result.htmlReady = true
    }
  } else if (streamEvent.type === 'error') {
    run.receivedStreamOutput = true
    results.push(parseTweakPhpError(streamEvent.error ?? 'Error'))
  }

  if (run.stagedResults) return

  syncTabQueries(tab)
  tabsStore.updateTab(tab)
}

const handleExecuteReply = (event: Event) => {
  const detail = isDetailEvent(event) ? event.detail : undefined
  if (!isRecord(detail) || typeof detail.tabId !== 'number') return
  const tabId = detail.tabId

  const tabsStore = useTabsStore()
  const executeStore = useExecuteStore()

  if (detail.streamingDone === true) {
    const tab = tabsStore.findTab(tabId)
    if (tab) flushStagedResults(tab, tabId)
    runs.delete(tabId)
    executeStore.endExecution(tabId)
    return
  }

  const run = getRun(tabId)
  const tab = tabsStore.findTab(tabId)

  if (!tab) {
    // the tab is gone (archived/closed while running): just clean up
    runs.delete(tabId)
    executeStore.endExecution(tabId)
    return
  }

  // a terminal non-streaming reply applies the current run's staged output before it
  flushStagedResults(tab, tabId)

  const connection: ConnectionConfig | undefined = tabsStore.getConnectionConfig(tab)
  const results = parseResults(detail.output)
  if (results) {
    tab.result = results
    syncTabQueries(tab)
  } else if (typeof detail.output === 'string' && detail.output.includes('TWEAKPHP_ERROR:')) {
    tab.result = [parseTweakPhpError(detail.output)]
    tab.queries = []
  } else {
    const output = stringifyReply(detail.error ?? detail.output ?? '')
    const errorResult = {
      code: '',
      line: 0,
      output: connection?.type === 'vapor' ? normalizeVaporOutput(output) : output,
      html: '',
    }
    tab.result = run?.receivedStreamOutput ? [...tab.result, errorResult] : [errorResult]
    if (!run?.receivedStreamOutput) {
      tab.queries = []
    }
  }

  runs.delete(tabId)
  executeStore.endExecution(tabId)
  tabsStore.updateTab(tab)
}

let initialized = false

// Registers the global stream/reply router once: it lives outside the views
// so executions keep processing while the user switches or opens other tabs.
export const initExecutionEvents = () => {
  if (initialized) return
  initialized = true
  events.addEventListener('client.execute.reply', handleExecuteReply)
  events.addEventListener('client.execute.stream', handleExecuteStream)
}
