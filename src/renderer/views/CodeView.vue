<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useExecuteStore } from '../stores/execute'
  import { useTabsStore } from '../stores/tabs'
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
  import { useLodaersStore } from '../stores/loaders'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabsStore = useTabsStore()
  const codeEditor = ref(null)
  const resultEditor = ref<InstanceType<typeof Editor> | null>(null)
  const loadersStore = useLodaersStore()

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
        tabsStore.removeTab(tab.value.id)
      }
    }
  }

  const executeReplyListener = (e: any) => {
    let result = e.detail ?? ''
    if (e.detail && e.detail.output !== undefined) {
      tab.value.result = e.detail.output
    } else {
      tab.value.result = [
        {
          code: '',
          line: 0,
          output: result,
          html: '',
        },
      ]
    }
    if (resultEditor.value) {
      resultEditor.value.updateValue(rawOutput.value)
    }
    tabsStore.updateTab(tab.value)
    executeStore.setExecuting(false)
  }

  const infoReplyListener = (e: any) => {
    tab.value.info = JSON.parse(e.detail)
    tabsStore.updateTab(tab.value)
  }

  const executeHandler = () => {
    let connection = tabsStore.getConnectionConfig(tab.value)
    const { code, loader } = tab.value
    const loaderCode = getLoader(loader ?? '')

    executeStore.setExecuting(true)

    window.ipcRenderer.send('client.execute', {
      connection: JSON.parse(JSON.stringify(connection)),
      code,
      loader: loaderCode,
    })
  }

  const getInfo = () => {
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

  const getLoader = (name: string) => {
    return loadersStore.get(name)?.code ?? ''
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
    events.addEventListener('client.execute.reply', executeReplyListener)
    events.addEventListener('client.info.reply', infoReplyListener)
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsStore.scrollPosition
      tabsContainer.value.addEventListener('wheel', tabsContainerWheelListener)
    }
  })

  onBeforeUnmount(async () => {
    window.removeEventListener('keydown', keydownListener)
    events.removeEventListener('client.execute.reply', executeReplyListener)
    events.removeEventListener('client.info.reply', infoReplyListener)
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

  watch(
    () => tab.value.execution,
    async () => {
      await nextTick()
      getInfo()
    }
  )

  watch(
    () => tab.value.loader,
    async () => {
      await nextTick()
      getInfo()
    }
  )

  watch(
    () => tab.value.type,
    async () => {
      await nextTick()
      getInfo()
    }
  )

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
          :editor-id="`${tab.id}-${Date.now()}-code`"
          v-model:value="tab.code"
          language="php"
          :wrap="true"
          :style="{
            borderColor: settingsStore.colors.border,
          }"
          :path="tab.path"
          :auto-focus="true"
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
