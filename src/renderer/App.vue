<script setup lang="ts">
  import { RouterLink, RouterView } from 'vue-router'
  import { useColorSchemeStore } from './stores/color-scheme'
  import { CogIcon, PlusIcon } from '@heroicons/vue/24/outline'
  import SidebarItem from './components/SidebarItem.vue'
  import TitleBar from './components/TitleBar.vue'
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { useTabsStore } from './stores/tabs'
  import { useHistoryStore } from './stores/history'
  import router from './router/index'
  import events from './events'
  import { useSettingsStore } from './stores/settings'
  import { initServices } from 'monaco-languageclient/vscode/services'
  import { useUpdateStore } from './stores/update'
  import { UpdateInfo } from 'electron-updater'
  import ProjectTile from './components/ProjectTile.vue'
  import Modal from './components/Modal.vue'
  import NewProjectView from './views/NewProjectView.vue'

  const colorSchemeStore = useColorSchemeStore()
  const colorSchemeSetup = () => {
    if (colorSchemeStore.isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const tabStore = useTabsStore()
  const historyStore = useHistoryStore()
  const settingsStore = useSettingsStore()
  const updateStore = useUpdateStore()

  const platform = window.platformInfo.getPlatform()
  const newProjectModal = ref()

  const isAppReady = ref(false)
  const initAppInterval = setInterval(() => {
    if (isAppReady.value) {
      clearInterval(initAppInterval)
      return
    }

    window.ipcRenderer.send('init')
  }, 500)

  onMounted(async () => {
    colorSchemeSetup()
    let media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', () => {
      colorSchemeStore.change()
      colorSchemeSetup()
    })
    window.ipcRenderer.on('update.available', (e: UpdateInfo) => {
      updateStore.setUpdate(e)
    })
    window.ipcRenderer.on('update.not-available', (e: UpdateInfo) => {
      updateStore.setUpdate(e)
    })
    window.ipcRenderer.on('update.checking', () => {
      updateStore.setChecking(true)
    })
    window.ipcRenderer.on('init.reply', async (e: any) => {
      settingsStore.setSettings(e.settings)
      isAppReady.value = true
    })
    window.ipcRenderer.on('source.open.reply', (e: any) => {
      let tab = tabStore.addTab({
        path: e,
        type: 'code',
      })
      historyStore.addHistory({ path: e })
      router.push({ name: 'code', params: { id: tab.id } })
      newProjectModal.value.closeModal()
    })
    window.ipcRenderer.on('client.connect.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.connect.reply', { detail: e }))
    })
    window.ipcRenderer.on('client.execute.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.execute.reply', { detail: e }))
    })
    window.ipcRenderer.on('client.action.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.action.reply', { detail: e }))
    })
    window.ipcRenderer.on('client.info.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.info.reply', { detail: e }))
    })

    window.addEventListener('keydown', keydownListener)

    await initEditor()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', keydownListener)
  })

  const initEditor = async () => {
    await initServices({
      serviceConfig: {
        debugLogging: true,
      },
    })
  }

  const keydownListener = (event: any) => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
      if (event.key === 'n') {
        event.preventDefault()
        newProjectModal.value.openModal()
      }
    }
  }
</script>

<template>
  <div v-if="isAppReady" class="h-full" :style="{ color: settingsStore.colors.foreground }">
    <TitleBar />
    <aside
      class="w-12 fixed z-40 left-0 bottom-0 justify-between border-r"
      :class="{
        'top-[38px]': platform === 'darwin',
        'top-0': platform !== 'darwin',
      }"
      :style="{
        backgroundColor: settingsStore.colors.background,
        borderColor: settingsStore.colors.border,
      }"
    >
      <div class="relative h-full flex flex-col justify-between pb-[70px]">
        <div class="min-h-full max-h-full no-scrollbar overflow-y-auto p-2 space-y-2">
          <button @click="newProjectModal.openModal()">
            <ProjectTile tooltip="Add new project" tooltip-placement="right">
              <PlusIcon class="w-4 h-4" />
            </ProjectTile>
          </button>
          <template v-for="tab in tabStore.tabs" :key="tab.id">
            <button
              @click="router.replace({ name: 'code', params: { id: tab.id } })"
              @mousedown.middle="tabStore.removeTab(tab.id)"
            >
              <ProjectTile
                :active="router.currentRoute.value.name === 'code' && tabStore.getCurrent()?.id === tab.id"
                :name="tab.name"
                :tooltip="tab.name"
                tooltip-placement="right"
              >
                {{ tab.name[0] }}
              </ProjectTile>
            </button>
          </template>
        </div>
        <div class="absolute bottom-0 left-0 border-t" :style="{ borderColor: settingsStore.colors.border }">
          <SidebarItem :active="router.currentRoute.value.path === '/settings'" class="relative">
            <span
              v-if="
                updateStore.update &&
                updateStore.isUpdateAvailable(settingsStore.settings.version, updateStore.update.version)
              "
              class="absolute top-[5px] right-[5px] bg-primary-500 text-white w-[7px] h-[7px] rounded-full"
            >
            </span>
            <RouterLink
              :to="{ name: 'settings' }"
              :class="{ 'text-primary-500': router.currentRoute.value.name === 'settings' }"
            >
              <CogIcon class="w-6 h-6 hover:text-primary-500" />
            </RouterLink>
          </SidebarItem>
        </div>
      </div>
    </aside>
    <div class="h-full flex pl-12">
      <main class="w-full h-full">
        <RouterView :key="$route.fullPath" />
      </main>
    </div>
    <Modal title="Add new project" ref="newProjectModal" size="xl">
      <NewProjectView @opened="newProjectModal.closeModal()" />
    </Modal>
  </div>
</template>
