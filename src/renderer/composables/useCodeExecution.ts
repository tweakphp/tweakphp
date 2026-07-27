import type { ComputedRef, Ref } from 'vue'
import { parseTweakPhpError } from '../../shared/tweakphp-error'
import type { Tab } from '../../types/tab.type'

export function useCodeExecution(options: {
  tab: Ref<Tab>
  rawOutput: ComputedRef<string>
  resultEditor: Ref<any>
  settingsStore: any
  executeStore: any
  tabsStore: any
  loadersStore: any
}) {
  const stringifyReply = (value: any): string => {
    if (typeof value === 'string') return value
    if (value instanceof Error) return value.message

    try {
      return JSON.stringify(value) ?? String(value)
    } catch (e) {
      return String(value)
    }
  }

  const getLoader = (name: string) => options.loadersStore.get(name)?.code ?? ''

  const updateResultEditor = () => {
    if (options.resultEditor.value) {
      options.resultEditor.value.updateValue(options.rawOutput.value)
    }
  }

  const executeReplyListener = (e: any) => {
    const result = e.detail ?? ''
    if (e.detail?.streamingDone) {
      options.executeStore.setExecuting(false)
      return
    }

    if (e.detail?.output !== undefined) {
      options.tab.value.result = e.detail.output
    } else if (typeof result === 'string' && result.includes('TWEAKPHP_ERROR:')) {
      options.tab.value.result = [parseTweakPhpError(result)]
    } else {
      options.tab.value.result = [
        {
          code: '',
          line: 0,
          output: stringifyReply(result),
          html: '',
        },
      ]
    }

    updateResultEditor()
    options.tabsStore.updateTab(options.tab.value)
    options.executeStore.setExecuting(false)
  }

  const executeStreamListener = (e: any) => {
    const detail = e.detail
    if (!detail || detail.tabId !== options.tab.value.id) return

    const event = detail.event
    if (!event) return

    if (event.type === 'started') {
      options.tab.value.result = []
      return
    }

    if (event.type === 'statement.started') {
      const existingIndex = options.tab.value.result.findIndex((_r: any, idx: number) => idx === event.index)
      if (existingIndex === -1) {
        options.tab.value.result.push({
          line: event.line,
          code: event.code,
          output: '',
          html: '',
          htmlReady: false,
          queries: [],
          query_errors: [],
        })
      }
    } else if (event.type === 'output') {
      const idx = event.index ?? 0
      if (!options.tab.value.result[idx]) {
        options.tab.value.result[idx] = {
          line: 0,
          code: '',
          output: '',
          html: '',
          htmlReady: false,
          queries: [],
        }
      }

      options.tab.value.result[idx].output += event.data
      if (typeof event.html === 'string') {
        options.tab.value.result[idx].html += event.html
      }
    } else if (event.type === 'statement.completed') {
      const idx = event.index ?? 0
      const result = options.tab.value.result[idx]

      if (result) {
        if (event.queries) result.queries = event.queries
        if (event.query_errors) result.query_errors = event.query_errors
        if (typeof event.html === 'string' && !result.html) result.html = event.html
        result.htmlReady = true
      }
    } else if (event.type === 'error') {
      options.tab.value.result.push(parseTweakPhpError(event.error ?? 'Error'))
    }

    updateResultEditor()
    options.tabsStore.updateTab(options.tab.value)
  }

  const executeHandler = () => {
    const connection = options.tabsStore.getConnectionConfig(options.tab.value)
    const { code, loader } = options.tab.value

    options.executeStore.setExecuting(true)

    if (options.settingsStore.settings.streaming) {
      options.tab.value.result = []
    }

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
