import { ref } from 'vue'
import { defineStore } from 'pinia'
import { applyExecuteReply, applyStreamEvent } from '../composables/useCodeExecution'
import { useTabsStore } from './tabs'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export const useExecuteStore = defineStore('execute', () => {
  const executing = ref(false)
  function setExecuting(value: boolean) {
    executing.value = value
  }

  /**
   * Route a final `client:execute:reply` to the tab it belongs to.
   *
   * Global (not per-view) so replies are never lost when the user navigates
   * away from CodeView during a slow SSH/Docker/Vapor execution, and never
   * applied to the wrong tab when the user switches tabs mid-run.
   */
  function handleExecuteReply(detail: unknown) {
    if (!isRecord(detail) || typeof detail.tabId !== 'number') return

    const tabsStore = useTabsStore()
    const tab = tabsStore.findTab(detail.tabId)
    if (tab) {
      applyExecuteReply(tab, detail, tabsStore)
    }
    setExecuting(false)
  }

  /** Route a `client:execute:stream` event to the tab it belongs to. */
  function handleExecuteStream(detail: unknown) {
    if (!isRecord(detail) || typeof detail.tabId !== 'number') return

    const tabsStore = useTabsStore()
    const tab = tabsStore.findTab(detail.tabId)
    if (tab) {
      applyStreamEvent(tab, detail, tabsStore)
    }
  }

  return { executing, setExecuting, handleExecuteReply, handleExecuteStream }
})
