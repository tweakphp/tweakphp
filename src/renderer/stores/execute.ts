import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

// Several executions can run concurrently, one per tab: this store tracks
// which tabs have a running execution. Play and Stop are per-tab (the button
// reflects the current tab) instead of a single global "executing" flag.
export const useExecuteStore = defineStore('execute', () => {
  const executingTabs = ref<Set<number>>(new Set())

  const executing = computed(() => executingTabs.value.size > 0)

  function isExecuting(tabId: number | null | undefined): boolean {
    return typeof tabId === 'number' && executingTabs.value.has(tabId)
  }

  function startExecution(tabId: number) {
    const next = new Set(executingTabs.value)
    next.add(tabId)
    executingTabs.value = next
  }

  function endExecution(tabId: number) {
    if (!executingTabs.value.has(tabId)) return
    const next = new Set(executingTabs.value)
    next.delete(tabId)
    executingTabs.value = next
  }

  return { executingTabs, executing, isExecuting, startExecution, endExecution }
})
