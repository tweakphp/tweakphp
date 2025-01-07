<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, Ref, ref, watch } from 'vue'
  import { useExecuteStore } from '../stores/execute'
  import { useTabsStore } from '../stores/tabs'
  import Container from '../components/Container.vue'
  import events from '../events'
  import { useSettingsStore } from '../stores/settings'
  import Editor from '../components/Editor.vue'
  import { useRoute } from 'vue-router'
  import router from '../router/index'
  import { Tab } from '../types/tab.type'
  import { PharPathResponse } from '../../main/types/docker.type.ts'
  import ProgressBar from '../components/ProgressBar.vue'
  import { Splitpanes, Pane } from 'splitpanes'
  import 'splitpanes/dist/splitpanes.css'
  import { useSSHStore } from '../stores/ssh'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabsStore = useTabsStore()
  const sshStore = useSSHStore()
  const codeEditor = ref(null)
  const resultEditor = ref<InstanceType<typeof Editor> | null>(null)
  const dockerClients: Ref<string[]> = ref([])

  const tabsContainer = ref<HTMLDivElement | null>(null)

  const tab = ref<Tab>({
    id: 0,
    type: '',
    name: '',
    code: '',
    path: '',
    execution: 'local',
    remote_phar_client: '',
    remote_path: '',
    result: '',
    pane: {
      code: 50,
      result: 50,
    },
    info: {
      name: '',
      php_version: '',
      version: '',
    },
    docker: {
      php: '',
      enable: false,
      container_id: '',
      container_name: '',
      php_version: '',
    },
  })
  const route = useRoute()

  const keydownListener = (event: any) => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
      if (event.key === 'r') {
        event.preventDefault()
        if (tab.value.type === 'code') {
          executeHandler()
        }
      }

      if (event.key === 't') {
        event.preventDefault()
        addTab()
      }

      if (event.key === 'w') {
        event.preventDefault()
        tabsStore.removeTab(tab.value.id)
      }
    }
  }

  const executeReplyListener = (e: any) => {
    tab.value.result = e.detail
    if (resultEditor.value) {
      resultEditor.value.updateValue(e.detail)
    }
    tabsStore.updateTab(tab.value)
    executeStore.setExecuting(false)
  }

  const infoReplyListener = (e: any) => {
    tab.value.info = JSON.parse(e.detail)
    tabsStore.updateTab(tab.value)
  }

  window.ipcRenderer.on('docker.copy-phar.reply', (e: PharPathResponse) => {
    e.container_id && dockerClients.value.push(e.container_id)
  })

  const executeHandler = () => {
    const { docker, code, path, remote_path, remote_phar_client } = tab.value
    const { php, container_id, php_version } = docker || {}

    executeStore.setExecuting(true)

    if (tab.value.execution === 'docker') {
      if (!dockerClients.value.includes(container_id)) {
        window.ipcRenderer.send('docker.copy-phar.execute', {
          php_version: php_version,
          container_id: container_id,
        })
      }

      window.ipcRenderer.send('client.docker.execute', {
        php,
        code,
        path: remote_path,
        phar_client: remote_phar_client,
        container_id,
      })

      return
    }

    if (tab.value.execution === 'ssh' && tab.value.ssh?.id) {
      let connection = sshStore.getConnection(tab.value.ssh.id)
      window.ipcRenderer.send('client.ssh.execute', {
        connection: { ...connection },
        code,
      })

      return
    }

    window.ipcRenderer.send('client.local.execute', {
      php: settingsStore.settings.php,
      code,
      path,
    })
  }

  const infoHandler = () => {
    if (tab.value.type === 'code') {
      window.ipcRenderer.send('client.local.info', {
        php: settingsStore.settings.php,
        path: tab.value.path,
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

    infoHandler()

    // add keyboard listener
    window.addEventListener('keydown', keydownListener)

    // add execute reply listener
    events.addEventListener('execute', executeHandler)

    // add execute listener
    events.addEventListener('client.execute.reply', executeReplyListener)

    // add info listener
    events.addEventListener('client.info.reply', infoReplyListener)

    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft = tabsStore.scrollPosition
      tabsContainer.value.addEventListener('wheel', tabsContainerWheelListener)
    }
  })

  onBeforeUnmount(async () => {
    // remove keyboard listener
    window.removeEventListener('keydown', keydownListener)

    // remove execute reply listener
    events.removeEventListener('client.execute.reply', executeReplyListener)

    // remove info listener
    events.removeEventListener('client.info.reply', infoReplyListener)

    // remote execute listener
    events.removeEventListener('execute', executeHandler)

    // remove tabsContainer wheel listener
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
      infoHandler()
    }
  )

  watch(
    () => tab.value.type,
    async () => {
      await nextTick()
      infoHandler()
    }
  )

  const addTab = async () => {
    let activeTab = tabsStore.addTab()
    await router.replace({ name: 'code', params: { id: activeTab.id } })
  }

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
</script>

<template>
  <Container v-if="tab && route.params.id" class="pt-[38px]">
    <Splitpanes
      v-if="tab.type === 'code'"
      v-bind:horizontal="settingsStore.settings.layout === 'horizontal'"
      class="pb-4 default-theme"
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
          :key="`result-${tab.id}`"
          ref="resultEditor"
          :editor-id="`${tab.id}-result`"
          v-model:value="tab.result"
          language="output"
          :readonly="true"
          :wrap="true"
        />
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
        <div class="whitespace-nowrap">
          PHP {{ tab.execution === 'docker' ? tab.docker.php_version : tab.info.php_version }}
        </div>
      </div>
      <div class="pr-2 flex items-center justify-end gap-3 w-1/2">
        <ProgressBar />
        <span class="whitespace-nowrap items-end">{{ tab.info.name }} {{ tab.info.version }}</span>
      </div>
    </div>
  </Container>
</template>
<style>
  .default-theme.splitpanes--vertical > .splitpanes__splitter,
  .default-theme .splitpanes--vertical > .splitpanes__splitter {
    width: 4px;
  }
  .default-theme.splitpanes--vertical > .splitpanes__splitter,
  .default-theme .splitpanes--vertical > .splitpanes__splitter {
    border-left: 0 !important;
    border-top: 0 !important;
  }
  .default-theme.splitpanes--horizontal > .splitpanes__splitter,
  .default-theme .splitpanes--horizontal > .splitpanes__splitter {
    border-left: 0 !important;
    border-top: 0 !important;
  }
  .splitpanes.default-theme .splitpanes__splitter {
    background: var(--splitter-gutter-bg) !important;
  }
  .splitpanes.default-theme .splitpanes__pane {
    background: var(--splitter-gutter-bg) !important;
  }
</style>
