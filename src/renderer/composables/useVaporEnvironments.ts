import { ref } from 'vue'
import type { Tab } from '../../types/tab.type'
import { useVaporStore } from '../stores/vapor'
import { errorMessage } from '../../shared/error-message'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// Shared across composable instances so the Toolbar and CodeView observe the
// same per-tab loading/error state
const loading = ref<Record<string | number, boolean>>({})
const errors = ref<Record<string | number, string | null>>({})

export const useVaporEnvironments = () => {
  const vaporStore = useVaporStore()

  /**
   * Request the environments for the project opened in the given tab. The
   * reply is handled by `replyListener`, which must be registered on the
   * `client:action:reply` event.
   */
  const fetchEnvironments = (tab: Tab | null) => {
    if (!tab?.id || !tab.path) {
      console.warn('No current tab or path set, cannot request environments.')
      return
    }
    errors.value[tab.id] = null
    loading.value[tab.id] = true
    vaporStore.setClientPath(tab.id, String(tab.path))
    const config = vaporStore.getConnectionConfig(tab.id)
    if (!config) {
      loading.value[tab.id] = false
      console.warn(`No vapor connection config for tab ${tab.id}, cannot request environments.`)
      return
    }
    window.ipcRenderer.send('client:action', {
      type: 'getEnvironments',
      connection: JSON.parse(JSON.stringify(config)),
      tabId: tab.id,
    })
  }

  const replyListener = (event: Event) => {
    const detail = 'detail' in event ? (event as CustomEvent).detail : undefined
    if (!isRecord(detail) || detail.type !== 'getEnvironments' || detail.tabId === undefined) return
    const tabId = detail.tabId as Tab['id']
    loading.value[tabId] = false
    if (detail.error) {
      errors.value[tabId] = errorMessage(detail.error)
      return
    }
    if (Array.isArray(detail.result)) {
      errors.value[tabId] = null
      vaporStore.setEnviroments(tabId, detail.result as string[])
    }
  }

  return { fetchEnvironments, replyListener, loading, errors }
}
