<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useExecuteStore } from '../stores/execute'
  import { useTabsStore } from '../stores/tabs'
  import { useVaporStore } from '../stores/vapor'
  import Container from '../components/Container.vue'
  import events from '../events'
  import { useSettingsStore } from '../stores/settings'
  import Editor from '../components/Editor.vue'
  import { useRoute } from 'vue-router'
  import router from '../router/index'
  import { Tab } from '../../types/tab.type'
  import { Splitpanes, Pane } from 'splitpanes'
  import 'splitpanes/dist/splitpanes.css'
  import StackedOutput from '../components/StackedOutput.vue'
  import { useLoadersStore } from '../stores/loaders'
  import { useCodeExecution } from '../composables/useCodeExecution'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const vaporStore = useVaporStore()
  const tabsStore = useTabsStore()
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

  const rawOutput = computed(() => {
    const output = [...tab.value.result].reverse().find(item => item.output.trim() !== '')
    return output ? output.output : ''
  })

  const { executeHandler, executeReplyListener, executeStreamListener, getLoader } = useCodeExecution({
    tab,
    rawOutput,
    resultEditor,
    codeEditor,
    settingsStore,
    executeStore,
    tabsStore,
    loadersStore,
  })

  const lspRestartSuccessListener = () => {
    console.log('LSP restart success, reconnecting editors...')
    if (codeEditor.value) {
      codeEditor.value.reconnectLsp()
    }
  }

  const vaporRequestEnvironmentTab = () => {
    if (!tabsStore.current?.id || !tabsStore.current?.path) {
      console.warn('No current tab or path set, cannot request environments.')
      return
    }
    vaporStore.setClientPath(tab.value.id, String(tabsStore.current?.path))
    const config = JSON.parse(JSON.stringify(vaporStore.getConnectionConfig(tabsStore.current?.id)))
    window.ipcRenderer.send('client.action', {
      type: 'getEnvironments',
      connection: config,
    })
  }

  const vaporResponseEnvironmentTab = (e: any) => {
    if (!tabsStore.current?.id) {
      console.warn('No current tab or path set, cannot request environments.')
      return
    }
    const reply = e.detail
    if (reply.type === 'getEnvironments') {
      vaporStore.setEnviroments(tabsStore.current?.id, e.detail.result)
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
    tab.value.info = JSON.parse(e.detail)
    tabsStore.updateTab(tab.value)
  }

  const getInfo = () => {
    vaporRequestEnvironmentTab()
    let connection = tabsStore.getConnectionConfig(tab.value)
    const { loader } = tab.value
    const loaderCode = getLoader(loader ?? '')

    if (connection && tab.value.type === 'code') {
      window.ipcRenderer.send('client.info', {
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
    window.ipcRenderer.on('lsp.restart.success', lspRestartSuccessListener)

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
    events.addEventListener('client.execute.reply', executeReplyListener)
    events.addEventListener('client.execute.stream', executeStreamListener)
    events.addEventListener('client.info.reply', infoReplyListener)
    events.addEventListener('client.action.reply', vaporResponseEnvironmentTab)
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsStore.scrollPosition
      tabsContainer.value.addEventListener('wheel', tabsContainerWheelListener)
    }
  })

  onBeforeUnmount(async () => {
    window.ipcRenderer.removeListener('lsp.restart.success', lspRestartSuccessListener)
    window.removeEventListener('keydown', keydownListener)
    events.removeEventListener('client.execute.reply', executeReplyListener)
    events.removeEventListener('client.execute.stream', executeStreamListener)
    events.removeEventListener('client.info.reply', infoReplyListener)
    events.removeEventListener('client.action.reply', vaporResponseEnvironmentTab)
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
      class="default-theme"
      @resized="paneResized"
    >
      <pane :size="tab.pane.code">
        <Editor
          :key="`code-${tab.id}`"
          ref="codeEditor"
          :editor-id="`${tab.id}-${Date.now()}-code`"
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
  </Container>
</template>
