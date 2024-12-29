<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, Ref, ref, watch } from 'vue'
  import { useExecuteStore } from '../stores/execute'
  import { useTabsStore } from '../stores/tabs'
  import { XMarkIcon, PlusIcon } from '@heroicons/vue/24/outline'
  import HomeView from '../views/HomeView.vue'
  import Container from '../components/Container.vue'
  import events from '../events'
  import { useSettingsStore } from '../stores/settings'
  import Editor from '../components/Editor.vue'
  import { useRoute } from 'vue-router'
  import router from '../router/index'
  import { Tab } from '../types/tab.type'
  import DockerTabConnection from '../components/DockerTabConnection.vue'

  const settingsStore = useSettingsStore()
  const executeStore = useExecuteStore()
  const tabsStore = useTabsStore()
  const codeEditor = ref(null)
  const resultEditor = ref<InstanceType<typeof Editor> | null>(null)
  const dockerClients: Ref<string[]> = ref([])

  const platform = window.platformInfo.getPlatform()
  const tabsContainer = ref<HTMLDivElement | null>(null)

  const tab = ref<Tab>({
    id: 0,
    type: '',
    name: '',
    code: '',
    path: '',
    remote_phar_client: '',
    remote_path: '',
    result: '',
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
        removeTab(tab.value)
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

  window.ipcRenderer.on('docker-install-phar-client-response', (e: { phar: string; container_id: string }) => {
    e.container_id && dockerClients.value.push(e.container_id)
  })

  const executeHandler = () => {
    const { docker, code, path, remote_path, remote_phar_client } = tab.value
    const { php, container_id, php_version } = docker || {}

    executeStore.setExecuting(true)

    if (docker.enable) {
      if (!dockerClients.value.includes(container_id)) {
        window.ipcRenderer.send('docker-install-phar-client', {
          phpVersion: php_version,
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

    window.ipcRenderer.send('client.local.execute', {
      php: settingsStore.settings.php,
      code,
      path,
    })
  }

  const infoHandler = () => {
    if (tab.value.type === 'code' && tab.value.info.name === '') {
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

  onMounted(async () => {
    if (settingsStore.settings.php === '') {
      await router.push({ name: 'settings' })
      alert('PHP path is not set!')
      return
    }
    let params: any = route.params
    let currentTab: null | Tab
    if (tabsStore.current) {
      currentTab = tabsStore.current
    } else {
      currentTab = tabsStore.findTab(params.id)
    }
    if (currentTab.id !== parseInt(params.id)) {
      await router.replace({ name: 'code', params: { id: currentTab.id } })
    } else {
      tab.value = currentTab
      tabsStore.setCurrent(currentTab)

      infoHandler()

      // add keyboard listener
      window.addEventListener('keydown', keydownListener)

      // add execute reply listener
      events.addEventListener('execute', executeHandler)

      // add execute listener
      events.addEventListener('client.execute.reply', executeReplyListener)

      // add info listener
      events.addEventListener('client.info.reply', infoReplyListener)
    }
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
    () => tabsStore.tabs.length,
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

  const removeTab = async (t: Tab) => {
    let activeTab = tabsStore.removeTab(t.id)
    await router.replace({ name: 'code', params: { id: activeTab.id } })
  }

  const addTab = async () => {
    let activeTab = tabsStore.addTab()
    await router.replace({ name: 'code', params: { id: activeTab.id } })
  }

  const setCurrentTab = async (t: Tab) => {
    tabsStore.setCurrent(t)
    await router.replace({ name: 'code', params: { id: t.id } })
  }
</script>

<template>
  <Container v-if="tab && route.params.id" :class="platform === 'darwin' ? 'pt-[38px]' : 'pt-0'">
    <div
      ref="tabsContainer"
      class="min-w-full max-w-full absolute flex h-7 border-b pr-14 no-scrollbar overflow-x-auto whitespace-nowrap"
      :class="{
        'top-[38px]': platform === 'darwin',
        'top-0 !pr-[150px]': platform !== 'darwin',
      }"
      :style="{
        backgroundColor: settingsStore.colors.background,
        borderColor: settingsStore.colors.border,
      }"
    >
      <div
        class="min-w-[120px] flex-none h-full border-r flex items-center justify-between"
        :style="{
          borderColor: settingsStore.colors.border,
          backgroundColor: t.id === tab.id ? settingsStore.colors.backgroundLight : settingsStore.colors.background,
        }"
        v-for="t in tabsStore.tabs"
        @mousedown.middle="removeTab(t)"
      >
        <button class="h-full w-full flex items-center px-2 text-xs cursor-pointer" @click="setCurrentTab(t)">
          {{ t.name }}
        </button>
        <button class="h-full w-6 flex flex-none items-center justify-center" @click="removeTab(t)">
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
      <button class="h-full w-6 flex items-center justify-center" @click="addTab()">
        <PlusIcon class="w-4 h-4" />
      </button>
    </div>
    <div
      v-if="tab.type === 'code'"
      class="w-full h-full pt-[28px] pb-6"
      :class="{
        'flex': settingsStore.settings.layout === 'vertical',
        'flex-col': settingsStore.settings.layout === 'horizontal',
      }"
    >
      <Editor
        :key="`code-${tab.id}`"
        ref="codeEditor"
        :editor-id="`${tab.id}-${Date.now()}-code`"
        v-model:value="tab.code"
        language="php"
        :wrap="true"
        :style="{
          height: settingsStore.settings.layout === 'horizontal' ? '50%' : '100%',
          borderColor: settingsStore.colors.border,
        }"
        :class="{
          'border-b': settingsStore.settings.layout === 'horizontal',
          'border-r': settingsStore.settings.layout === 'vertical',
        }"
        :path="tab.path"
        :auto-focus="true"
      />
      <Editor
        :key="`result-${tab.id}`"
        ref="resultEditor"
        :editor-id="`${tab.id}-result`"
        v-model:value="tab.result"
        language="output"
        :readonly="true"
        :wrap="true"
        :style="{
          height: settingsStore.settings.layout === 'horizontal' ? '50%' : '100%',
        }"
      />
      <div
        v-if="tab.info"
        class="pl-12 fixed bottom-0 left-0 right-0 border-t z-10 h-6 flex items-center justify-between text-xs"
        :style="{
          borderColor: settingsStore.colors.border,
          backgroundColor: settingsStore.colors.background,
        }"
      >
        <div class="flex gap-2">
          <div class="px-2">PHP {{ tab.docker.enable ? tab.docker.php_version : tab.info.php_version }}</div>
          <DockerTabConnection :tab="tab" />
        </div>
        <div class="px-2">{{ tab.info.name }} {{ tab.info.version }}</div>
      </div>
    </div>
    <div v-if="tab.type === 'home'" class="w-full h-full pt-[28px]">
      <HomeView :key="`home-${tab.id}`" :tab="tab" />
    </div>
  </Container>
</template>
