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

interface DetailEvent extends Event {
  detail: unknown
}

type StreamEvent =
  | { type: 'started' }
  | { type: 'statement.started'; index: number; line: number; code: string }
  | { type: 'output'; index?: number; data: string; html?: string }
  | { type: 'statement.completed'; index?: number; queries?: unknown[]; query_errors?: unknown[]; html?: string }
  | { type: 'error'; error?: unknown }

const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null

const isDetailEvent = (event: Event): event is DetailEvent => 'detail' in event

type ResultPayload = Omit<Result, 'html'> & { html?: string }

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

export function useCodeExecution(options: {
  tab: Ref<Tab>
  rawOutput: ComputedRef<string>
  resultEditor: Ref<ResultEditor | null>
  settingsStore: SettingsStore
  executeStore: ExecuteStore
  tabsStore: TabsStore
  loadersStore: LoadersStore
}) {
  const stringifyReply = (value: unknown): string => {
    if (typeof value === 'string') return stripAnsi(value)
    if (value instanceof Error) return value.message

    try {
      return JSON.stringify(value) ?? String(value)
    } catch {
      return String(value)
    }
  }

  const getLoader = (name: string) => options.loadersStore.get(name)?.code ?? ''

  const updateResultEditor = () => {
    if (options.resultEditor.value) {
      options.resultEditor.value.updateValue(options.rawOutput.value)
    }
  }

  const syncTabQueries = () => {
    options.tab.value.queries = options.tab.value.result.flatMap(result =>
      Array.isArray(result.queries) ? result.queries : []
    )
  }

  const executeReplyListener = (event: Event) => {
    const detail = isDetailEvent(event) ? event.detail : undefined
    const connection = options.tabsStore.getConnectionConfig(options.tab.value)
    if (isRecord(detail) && detail.streamingDone === true) {
      options.executeStore.setExecuting(false)
      return
    }

    const results = isRecord(detail) ? parseResults(detail.output) : null
    if (results) {
      options.tab.value.result = results
      syncTabQueries()
    } else if (typeof detail === 'string' && detail.includes('TWEAKPHP_ERROR:')) {
      options.tab.value.result = [parseTweakPhpError(detail)]
      options.tab.value.queries = []
    } else {
      const output = stringifyReply(detail ?? '')
      options.tab.value.result = [
        {
          code: '',
          line: 0,
          output: connection?.type === 'vapor' ? normalizeVaporOutput(output) : output,
          html: '',
        },
      ]
      options.tab.value.queries = []
    }

    updateResultEditor()
    options.tabsStore.updateTab(options.tab.value)
    options.executeStore.setExecuting(false)
  }

  const executeStreamListener = (event: Event) => {
    const detail = isDetailEvent(event) && isRecord(event.detail) ? event.detail : null
    if (!detail || detail.tabId !== options.tab.value.id) return

    const streamEvent = parseStreamEvent(detail.event)
    if (!streamEvent) return

    if (streamEvent.type === 'started') {
      options.tab.value.result = []
      options.tab.value.queries = []
      return
    }

    if (streamEvent.type === 'statement.started') {
      const existingIndex = options.tab.value.result.findIndex((_result, index) => index === streamEvent.index)
      if (existingIndex === -1) {
        options.tab.value.result.push({
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
      if (!options.tab.value.result[index]) {
        options.tab.value.result[index] = {
          line: 0,
          code: '',
          output: '',
          html: '',
          htmlReady: false,
          queries: [],
        }
      }

      options.tab.value.result[index].output += stripAnsi(streamEvent.data)
      if (streamEvent.html !== undefined) {
        options.tab.value.result[index].html += streamEvent.html
      }
    } else if (streamEvent.type === 'statement.completed') {
      const index = streamEvent.index ?? 0
      const result = options.tab.value.result[index]

      if (result) {
        if (streamEvent.queries) result.queries = streamEvent.queries
        if (streamEvent.query_errors) result.query_errors = streamEvent.query_errors
        if (streamEvent.html !== undefined && !result.html) result.html = streamEvent.html
        result.htmlReady = true
      }
    } else if (streamEvent.type === 'error') {
      options.tab.value.result.push(parseTweakPhpError(streamEvent.error ?? 'Error'))
    }

    syncTabQueries()
    updateResultEditor()
    options.tabsStore.updateTab(options.tab.value)
  }

  const executeHandler = () => {
    const connection = options.tabsStore.getConnectionConfig(options.tab.value)
    const { code, loader } = options.tab.value

    options.executeStore.setExecuting(true)
    options.tab.value.queries = []

    if (options.settingsStore.settings.streaming) {
      options.tab.value.result = []
    }

    options.tabsStore.updateTab(options.tab.value)

    window.ipcRenderer.send('client.execute', {
      connection: JSON.parse(JSON.stringify(connection)),
      code,
      loader: getLoader(loader ?? ''),
      tabId: options.tab.value.id,
      streaming: !!options.settingsStore.settings.streaming,
    })
  }

  return { executeHandler, executeReplyListener, executeStreamListener, getLoader }
}
