<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useExecuteStore } from '../stores/execute'
  import { useTabsStore } from '../stores/tabs'
  import { useVaporStore } from '../stores/vapor'
  import { useLspStore } from '../stores/lsp'
  import Container from '../components/Container.vue'
  import events from '../events'
  import { useSettingsStore } from '../stores/settings'
  import Editor from '../components/Editor.vue'
  import { useRoute } from 'vue-router'
  import router from '../router/index'
  import { Tab } from '../../types/tab.type'
  import ProgressBar from '../components/ProgressBar.vue'
  import { Splitpanes, Pane } from 'splitpanes'
  import 'splitpanes/dist/splitpanes.css'
  import StackedOutput from '../components/StackedOutput.vue'
  import { useLoadersStore } from '../stores/loaders'
  import { useCodeExecution } from '../composables/useCodeExecution'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const vaporStore = useVaporStore()
  const tabsStore = useTabsStore()
  const lspStore = useLspStore()
  const codeEditor = ref<InstanceType<typeof Editor> | null>(null)
  const resultEditor = ref<InstanceType<typeof Editor> | null>(null)
  const loadersStore = useLoadersStore()

  const tabsContainer = ref<HTMLDivElement | null>(null)

  const tab = ref<Tab>({
    id: 0,
    type: '',
    name: '',
    code: '',
    path: '',
    execution: 'local',
    result: [],
    pane: {
      code: 50,
      result: 50,
    },
    info: {
      name: '',
      php_version: '',
      version: '',
    },
  })
  const route = useRoute()

  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

  const isDetailEvent = (event: Event): event is CustomEvent => 'detail' in event

  const rawOutput = computed(() => {
    const output = [...tab.value.result].reverse().find(item => item.output.trim() !== '')
    return output ? output.output : ''
  })

  const lspStatusTooltip = computed(() => {
    switch (lspStore.status) {
      case 'connected':
        return 'LSP Connected'
      case 'connecting':
        return 'LSP Connecting...'
      case 'disconnected':
        return 'LSP Disconnected (Click to reconnect)'
    }
  })

  const { executeHandler, updateResultEditor, getLoader } = useCodeExecution({
    tab,
    rawOutput,
    resultEditor,
    codeEditor,
    settingsStore,
    executeStore,
    tabsStore,
    loadersStore,
  })

  // Results are applied globally by the execute store; this only refreshes the
  // result editor when the applied tab is the one currently mounted
  const executeAppliedListener = (event: Event) => {
    const detail = isDetailEvent(event) && isRecord(event.detail) ? event.detail : null
    if (detail && detail.tabId === tab.value.id) {
      updateResultEditor()
    }
  }

  const handleLspReconnect = async () => {
    let restartError: string | null = null
    try {
      const result = await window.ipcRenderer.invoke('lsp:restart')
      if (result?.error) {
        restartError = typeof result.error === 'string' ? result.error : String(result.error.message ?? result.error)
      }
    } catch (error: any) {
      restartError = error?.message ? String(error.message) : String(error)
    }
    if (restartError) {
      // Restart failures are otherwise completely silent for the user
      alert(`Failed to restart the PHP language server: ${restartError}`)
    }
    try {
      // @ts-ignore - template ref typed at runtime
      codeEditor?.value?.reconnectLsp && codeEditor.value.reconnectLsp()
    } catch (e) {}
  }

  const vaporRequestEnvironmentTab = () => {
    if (!tab.value.id || !tab.value.path) {
      console.warn('No current tab or path set, cannot request environments.')
      return
    }
    vaporStore.setClientPath(tab.value.id, String(tab.value.path))
    const config = vaporStore.getConnectionConfig(tab.value.id)
    if (!config) {
      console.warn(`No vapor connection config for tab ${tab.value.id}, cannot request environments.`)
      return
    }
    window.ipcRenderer.send('client:action', {
      type: 'getEnvironments',
      connection: JSON.parse(JSON.stringify(config)),
      tabId: tab.value.id,
    })
  }

  const vaporResponseEnvironmentTab = (e: any) => {
    const reply = e?.detail
    if (!isRecord(reply) || reply.type !== 'getEnvironments') return
    // Correlate the reply to the tab that requested it, not to whichever tab
    // happens to be current when the (possibly delayed) reply arrives
    if (reply.tabId !== tab.value.id) return
    if (Array.isArray(reply.result)) {
      vaporStore.setEnviroments(tab.value.id, reply.result)
    }
  }

  const keydownListener = (event: any) => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
      if (event.key === 'r') {
        event.preventDefault()
        if (tab.value.type === 'code') {
          executeHandler()
        }
      }

      if (event.key === 'w') {
        event.preventDefault()
        events.dispatchEvent(new CustomEvent('tab.close.request', { detail: tab.value.id }))
      }
    }
  }

  const infoReplyListener = (e: any) => {
    // The reply can be a JSON string (success) or an arbitrary error payload
    // (e.g. a serialized Error): never throw on it, just keep the stale info
    try {
      const parsed = typeof e?.detail === 'string' ? JSON.parse(e.detail) : e?.detail
      if (!isRecord(parsed)) return
      const hasValidField =
        typeof parsed.name === 'string' || typeof parsed.php_version === 'string' || typeof parsed.version === 'string'
      if (!hasValidField) return
      tab.value.info = {
        name: typeof parsed.name === 'string' ? parsed.name : tab.value.info.name,
        php_version: typeof parsed.php_version === 'string' ? parsed.php_version : tab.value.info.php_version,
        version: typeof parsed.version === 'string' ? parsed.version : tab.value.info.version,
      }
      tabsStore.updateTab(tab.value)
    } catch {
      // Non-JSON stdout (e.g. PHP warnings before the JSON payload): ignore
    }
  }

  const getInfo = () => {
    // Only vapor tabs need the environments request: calling it for
    // local/ssh/docker/kubectl tabs would create and persist a vapor config
    // row (keyed by tab id) on every mount / execution change
    if (tab.value.execution === 'vapor') {
      vaporRequestEnvironmentTab()
    }
    let connection = tabsStore.getConnectionConfig(tab.value)
    const { loader } = tab.value
    const loaderCode = getLoader(loader ?? '')

    if (connection && tab.value.type === 'code') {
      window.ipcRenderer.send('client:info', {
        connection: JSON.parse(JSON.stringify(connection)),
        loader: loaderCode,
      })
    }
  }

  const tabsContainerWheelListener = (event: WheelEvent) => {
    if (event.deltaY !== 0) {
      event.preventDefault()
      tabsContainer.value!.scrollLeft += event.deltaY as number
      tabsStore.setScrollPosition(tabsContainer.value!.scrollLeft)
    }
  }

  const paneResized = (e: any) => {
    if (tabsStore.current) {
      tabsStore.current.pane.code = e[0].size
      tabsStore.current.pane.result = e[1].size
      tabsStore.updateTab(tabsStore.current)
    }
  }

  onMounted(async () => {
    if (settingsStore.settings.php === '') {
      await router.push({ name: 'settings' })
      alert('PHP path is not set!')
      return
    }
    let params: any = route.params
    if (params.id) {
      let t = tabsStore.findTab(params.id)
      if (t) {
        tab.value = t
        tabsStore.setCurrent(tab.value)
      }
    }
    if (!tab.value.id) {
      let t = tabsStore.getCurrent()
      if (t) {
        tab.value = t
        setCurrentTab(tab.value)
      }
    }
    if (!tab.value.id) {
      return
    }

    getInfo()

    window.addEventListener('keydown', keydownListener)
    events.addEventListener('execute', executeHandler)
    events.addEventListener('client:execute:applied', executeAppliedListener)
    events.addEventListener('client:info:reply', infoReplyListener)
    events.addEventListener('client:action:reply', vaporResponseEnvironmentTab)
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsStore.scrollPosition
      tabsContainer.value.addEventListener('wheel', tabsContainerWheelListener)
    }
  })

  onBeforeUnmount(async () => {
    window.removeEventListener('keydown', keydownListener)
    events.removeEventListener('client:execute:applied', executeAppliedListener)
    events.removeEventListener('client:info:reply', infoReplyListener)
    events.removeEventListener('client:action:reply', vaporResponseEnvironmentTab)
    events.removeEventListener('execute', executeHandler)
    if (tabsContainer.value) {
      tabsContainer.value.removeEventListener('wheel', tabsContainerWheelListener)
    }
  })

  watch(
    () => tab.value.code,
    () => {
      tabsStore.updateTab(tab.value)
    }
  )

  watch([() => tab.value.execution, () => tab.value.loader, () => tab.value.type], async () => {
    await nextTick()
    getInfo()
  })

  const setCurrentTab = async (t: Tab) => {
    tabsStore.setCurrent(t)
    await router.replace({ name: 'code', params: { id: t.id } })
  }

  watch(
    () => settingsStore.colors.backgroundLight,
    color => {
      const rootStyle = document.documentElement.style
      rootStyle.setProperty('--splitter-gutter-bg', color)
    },
    { immediate: true }
  )

  watch(
    () => settingsStore.settings.output,
    async () => {
      await nextTick()
      if (resultEditor.value) {
        resultEditor.value.updateValue(rawOutput.value)
      }
    }
  )
</script>

<template>
  <Container v-if="tab && route.params.id" class="pt-[38px]">
    <Splitpanes
      v-if="tab.type === 'code'"
      v-bind:horizontal="settingsStore.settings.layout === 'horizontal'"
      class="pb-6 default-theme"
      @resized="paneResized"
    >
      <pane :size="tab.pane.code">
        <Editor
          :key="`code-${tab.id}`"
          ref="codeEditor"
          :editor-id="`${tab.id}-code`"
          v-model:value="tab.code"
          language="php"
          :wrap="true"
          :style="{
            borderColor: settingsStore.colors.border,
          }"
          :path="tab.path"
          :auto-focus="true"
          :enable-history="true"
          :with-ai-completion="true"
        />
      </pane>
      <pane :size="tab.pane.result">
        <Editor
          v-if="settingsStore.settings.output === 'code'"
          :key="`result-${tab.id}`"
          ref="resultEditor"
          :editor-id="`${tab.id}-result`"
          :value="rawOutput"
          language="output"
          :readonly="true"
          :wrap="true"
        />
        <StackedOutput v-else :output="tab.result" />
      </pane>
    </Splitpanes>

    <div
      v-if="tab.info"
      class="pl-12 fixed bottom-0 left-0 right-0 border-t z-10 h-6 flex items-center justify-between text-xs"
      :style="{
        borderColor: settingsStore.colors.border,
        backgroundColor: settingsStore.colors.background,
      }"
    >
      <div
        class="flex items-center ml-2 cursor-pointer"
        :class="[settingsStore.isNavigationExpanded ? 'pl-[145px]' : '']"
        v-tippy="lspStatusTooltip"
        @click="handleLspReconnect"
      >
        <template v-if="lspStore.status === 'connected'">
          <div class="flex items-center justify-center bg-green-500 rounded-full size-3"></div>
        </template>
        <template v-else-if="lspStore.status === 'connecting'">
          <div class="flex items-center justify-center bg-yellow-500 rounded-full size-3"></div>
        </template>
        <template v-else-if="lspStore.status === 'disconnected'">
          <div class="flex items-center justify-center bg-red-500 rounded-full size-3"></div>
        </template>
      </div>
      <div class="px-2 flex gap-1 w-1/2 items-center">
        <div class="whitespace-nowrap">PHP {{ tab.info.php_version }}</div>
      </div>
      <div class="pr-2 flex items-center justify-end gap-3 w-1/2">
        <ProgressBar />
        <span class="whitespace-nowrap items-end">{{ tab.info.name }} {{ tab.info.version }}</span>
      </div>
    </div>
  </Container>
</template>
