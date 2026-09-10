import type { ComputedRef, Ref } from 'vue'
import { parseTweakPhpError } from '../../shared/tweakphp-error'
import type { Result, Tab } from '../../types/tab.type'
import type { ConnectionConfig as DockerConnectionConfig } from '../../types/docker.type'
import type { ConnectionConfig as KubectlConnectionConfig } from '../../types/kubectl.type'
import type { ConnectionConfig as LocalConnectionConfig } from '../../types/local.type'
import type { Loader } from '../../types/loader.type'
import type { Settings } from '../../types/settings.type'
import type { ConnectionConfig as SSHConnectionConfig } from '../../types/ssh.type'
import type { ConnectionConfig as VaporConnectionConfig } from '../../types/vapor.type'
import { normalizeVaporOutput, stripAnsi } from '../utils/output'
import events from '../events'

type ConnectionConfig =
  LocalConnectionConfig | SSHConnectionConfig | VaporConnectionConfig | DockerConnectionConfig | KubectlConnectionConfig

interface ResultEditor {
  updateValue: (value: string) => void
}

interface SettingsStore {
  settings: Settings
}

interface ExecuteStore {
  setExecuting: (value: boolean) => void
}

interface TabsStore {
  getConnectionConfig: (tab: Tab) => ConnectionConfig | undefined
  updateTab: (tab: Tab) => void
}

interface LoadersStore {
  get: (name: string) => Loader | undefined
}

interface RecordValue {
  [key: string]: unknown
}

type StreamEvent =
  | { type: 'started' }
  | { type: 'statement.started'; index: number; line: number; code: string }
  | { type: 'output'; index?: number; data: string; html?: string }
  | { type: 'statement.completed'; index?: number; queries?: unknown[]; query_errors?: unknown[]; html?: string }
  | { type: 'error'; error?: unknown }

const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null

type ResultPayload = Omit<Result, 'html'> & { html?: string }

const isResultPayload = (value: unknown): value is ResultPayload =>
  isRecord(value) &&
  typeof value.line === 'number' &&
  typeof value.code === 'string' &&
  typeof value.output === 'string' &&
  (value.html === undefined || typeof value.html === 'string')

const parseResults = (value: unknown): Result[] | null => {
  // The non-streaming phar client replies with the envelope
  // `{ output: Result[], queries: unknown[] }` — unwrap it
  const results = isRecord(value) && Array.isArray(value.output) ? value.output : value

  if (!Array.isArray(results) || !results.every(isResultPayload)) return null

  return results.map(result => ({
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

const syncTabQueries = (tab: Tab) => {
  tab.queries = tab.result.flatMap(result => (Array.isArray(result.queries) ? result.queries : []))
}

const notifyResultsApplied = (tab: Tab) => {
  events.dispatchEvent(new CustomEvent('client:execute:applied', { detail: { tabId: tab.id } }))
}

export interface ExecuteApplyContext {
  getConnectionConfig: (tab: Tab) => ConnectionConfig | undefined
  updateTab: (tab: Tab) => void
}

/**
 * Apply a final `client:execute:reply` payload to the tab it belongs to.
 *
 * The reply envelope is `{ tabId, streamingDone? , output? , error? }` — the
 * `tabId` correlation is done by the caller (execute store), so results land
 * on the originating tab even when it is not the currently mounted view.
 */
export const applyExecuteReply = (tab: Tab, detail: RecordValue, ctx: ExecuteApplyContext) => {
  if (detail.streamingDone === true) return

  const connection = ctx.getConnectionConfig(tab)
  const payload = detail.output !== undefined ? detail.output : detail.error

  const results = parseResults(payload)
  if (results) {
    tab.result = results
    syncTabQueries(tab)
  } else if (typeof payload === 'string' && payload.includes('TWEAKPHP_ERROR:')) {
    tab.result = [parseTweakPhpError(payload)]
    tab.queries = []
  } else {
    const output = stringifyReply(payload ?? '')
    tab.result = [
      {
        code: '',
        line: 0,
        output: connection?.type === 'vapor' ? normalizeVaporOutput(output) : output,
        html: '',
      },
    ]
    tab.queries = []
  }

  ctx.updateTab(tab)
  notifyResultsApplied(tab)
}

/**
 * Apply a `client:execute:stream` event to the tab it belongs to
 * (the event envelope carries `tabId`).
 */
export const applyStreamEvent = (tab: Tab, detail: RecordValue, ctx: ExecuteApplyContext) => {
  if (detail.tabId !== tab.id) return

  const streamEvent = parseStreamEvent(detail.event)
  if (!streamEvent) return

  if (streamEvent.type === 'started') {
    tab.result = []
    tab.queries = []
    return
  }

  if (streamEvent.type === 'statement.started') {
    const existingIndex = tab.result.findIndex((_result, index) => index === streamEvent.index)
    if (existingIndex === -1) {
      tab.result.push({
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
    const index = streamEvent.index ?? 0
    if (!tab.result[index]) {
      tab.result[index] = {
        line: 0,
        code: '',
        output: '',
        html: '',
        htmlReady: false,
        queries: [],
      }
    }

    tab.result[index].output += stripAnsi(streamEvent.data)
    if (streamEvent.html !== undefined) {
      tab.result[index].html += streamEvent.html
    }
  } else if (streamEvent.type === 'statement.completed') {
    const index = streamEvent.index ?? 0
    const result = tab.result[index]

    if (result) {
      if (streamEvent.queries) result.queries = streamEvent.queries
      if (streamEvent.query_errors) result.query_errors = streamEvent.query_errors
      if (streamEvent.html !== undefined && !result.html) result.html = streamEvent.html
      result.htmlReady = true
    }
  } else if (streamEvent.type === 'error') {
    tab.result.push(parseTweakPhpError(streamEvent.error ?? 'Error'))
  }

  syncTabQueries(tab)
  ctx.updateTab(tab)
  notifyResultsApplied(tab)
}

interface CodeEditor {
  getSelectedText: () => string
}

export function useCodeExecution(options: {
  tab: Ref<Tab>
  rawOutput: ComputedRef<string>
  resultEditor: Ref<ResultEditor | null>
  codeEditor?: Ref<CodeEditor | null>
  settingsStore: SettingsStore
  executeStore: ExecuteStore
  tabsStore: TabsStore
  loadersStore: LoadersStore
}) {
  const getLoader = (name: string) => options.loadersStore.get(name)?.code ?? ''

  const updateResultEditor = () => {
    if (options.resultEditor.value) {
      options.resultEditor.value.updateValue(options.rawOutput.value)
    }
  }

  const executeHandler = () => {
    const connection = options.tabsStore.getConnectionConfig(options.tab.value)
    if (!connection) {
      // Tab with execution 'docker'|'ssh'|'kubectl'|'vapor' but its config is
      // missing/removed: without this guard JSON.stringify(undefined) throws
      console.error(
        `No connection config for execution "${options.tab.value.execution}" on tab ${options.tab.value.id}`
      )
      return
    }
    const { loader } = options.tab.value
    const selected = options.codeEditor?.value?.getSelectedText() ?? ''
    const code = selected !== '' ? selected : options.tab.value.code

    options.executeStore.setExecuting(true)
    options.tab.value.queries = []

    if (options.settingsStore.settings.streaming) {
      options.tab.value.result = []
    }

    options.tabsStore.updateTab(options.tab.value)

    window.ipcRenderer.send('client:execute', {
      connection: JSON.parse(JSON.stringify(connection)),
      code,
      loader: getLoader(loader ?? ''),
      tabId: options.tab.value.id,
      streaming: !!options.settingsStore.settings.streaming,
    })
  }

  return { executeHandler, updateResultEditor, getLoader }
}
