import type { Ref } from 'vue'
import type { Tab } from '../../types/tab.type'
import type { ConnectionConfig as DockerConnectionConfig } from '../../types/docker.type'
import type { ConnectionConfig as KubectlConnectionConfig } from '../../types/kubectl.type'
import type { ConnectionConfig as LocalConnectionConfig } from '../../types/local.type'
import type { ConnectionConfig as SSHConnectionConfig } from '../../types/ssh.type'
import type { ConnectionConfig as VaporConnectionConfig } from '../../types/vapor.type'
import type { Loader } from '../../types/loader.type'
import type { Settings } from '../../types/settings.type'
import { prepareExecution } from '../stores/execution-events'

type ConnectionConfig =
  LocalConnectionConfig | SSHConnectionConfig | VaporConnectionConfig | DockerConnectionConfig | KubectlConnectionConfig

interface SettingsStore {
  settings: Settings
}

interface ExecuteStore {
  isExecuting: (tabId: number | null | undefined) => boolean
  startExecution: (tabId: number) => void
}

interface TabsStore {
  getConnectionConfig: (tab: Tab) => ConnectionConfig | undefined
}

interface LoadersStore {
  get: (name: string) => Loader | undefined
}

interface CodeEditor {
  getSelectedText: () => string
}

export function useCodeExecution(options: {
  tab: Ref<Tab>
  codeEditor?: Ref<CodeEditor | null>
  settingsStore: SettingsStore
  executeStore: ExecuteStore
  tabsStore: TabsStore
  loadersStore: LoadersStore
}) {
  const getLoader = (name: string) => options.loadersStore.get(name)?.code ?? ''

  const executeHandler = () => {
    // one execution per tab: re-running while this tab is busy is blocked
    // (the title bar shows Stop for it), other tabs keep playing freely
    if (options.executeStore.isExecuting(options.tab.value.id)) {
      return
    }

    const connection = options.tabsStore.getConnectionConfig(options.tab.value)
    const { loader } = options.tab.value
    const selected = options.codeEditor?.value?.getSelectedText() ?? ''
    const code = selected !== '' ? selected : options.tab.value.code
    const streaming = !!options.settingsStore.settings.streaming

    prepareExecution(options.tab.value.id, streaming)
    options.executeStore.startExecution(options.tab.value.id)

    window.ipcRenderer.send('client.execute', {
      connection: JSON.parse(JSON.stringify(connection)),
      code,
      loader: getLoader(loader ?? ''),
      tabId: options.tab.value.id,
      streaming,
    })
  }

  const stopHandler = () => {
    window.ipcRenderer.send('client.execute.stop', { tabId: options.tab.value.id })
  }

  return { executeHandler, stopHandler, getLoader }
}
