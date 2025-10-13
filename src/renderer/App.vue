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
  import ProjectMenuContext from '@/components/contextMenus/ProjectMenuContext.vue'

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

  const unhandledRejectionListener = (event: PromiseRejectionEvent) => {
    const reason: any = event.reason
    const message = typeof reason === 'string' ? reason : reason?.message
    const name = reason?.name
    if (
      (typeof message === 'string' && message.includes('Pending response rejected since connection got disposed')) ||
      name === '_ResponseError'
    ) {
      event.preventDefault()
      return
    }
  }

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
    window.addEventListener('unhandledrejection', unhandledRejectionListener)

    await initEditor()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', keydownListener)
    window.removeEventListener('unhandledrejection', unhandledRejectionListener)
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
      class="fixed z-40 left-0 bottom-0 justify-between border-r transition-all duration-300"
      :class="{
        'top-[38px]': platform === 'darwin',
        'top-0': platform !== 'darwin',
        'w-12': !settingsStore.isNavigationExpanded,
        'w-48': settingsStore.isNavigationExpanded,
      }"
      :style="{
        backgroundColor: settingsStore.colors.background,
        borderColor: settingsStore.colors.border,
      }"
    >
      <div class="relative h-full flex flex-col justify-between pb-[70px]">
        <div class="min-h-full max-h-full no-scrollbar overflow-y-auto p-2 space-y-2">
          <button @click="newProjectModal.openModal()" class="w-full">
            <ProjectTile
              tooltip="Add new project"
              tooltip-placement="right"
              :expanded="settingsStore.isNavigationExpanded"
            >
              <PlusIcon class="w-4 h-4 flex-shrink-0" />
              <span v-if="settingsStore.isNavigationExpanded" class="ml-2 text-sm truncate block min-w-0 flex-1">
                Add new project
              </span>
            </ProjectTile>
          </button>
          <template v-for="tab in tabStore.tabs" :key="tab.id">
            <button
              @click="router.replace({ name: 'code', params: { id: tab.id } })"
              @mousedown.middle="tabStore.removeTab(tab.id)"
              class="w-full"
            >
              <ProjectMenuContext :tab="tab">
                <ProjectTile
                  :active="router.currentRoute.value.name === 'code' && tabStore.getCurrent()?.id === tab.id"
                  :name="tab.name"
                  :tooltip="settingsStore.isNavigationExpanded ? '' : tab.name"
                  :expanded="settingsStore.isNavigationExpanded"
                  tooltip-placement="right"
                >
                  <span v-if="settingsStore.isNavigationExpanded" class="text-sm truncate block min-w-0 flex-1">
                    {{ tab.name }}
                  </span>
                  <span v-else class="flex-shrink-0">
                    {{ tab.name[0] }}
                  </span>
                </ProjectTile>
              </ProjectMenuContext>
            </button>
          </template>
        </div>
        <div class="absolute bottom-0 left-0 w-full border-t" :style="{ borderColor: settingsStore.colors.border }">
          <SidebarItem :active="router.currentRoute.value.path === '/settings'" class="relative">
            <span
              v-if="
                updateStore.update &&
                updateStore.isUpdateAvailable(settingsStore.settings.version, updateStore.update.version)
              "
              class="absolute bg-primary-500 text-white w-[7px] h-[7px] rounded-full"
              :class="{
                'top-[5px] right-[5px]': !settingsStore.isNavigationExpanded,
                'top-[12px] right-[12px]': settingsStore.isNavigationExpanded,
              }"
            >
            </span>
            <RouterLink
              :to="{ name: 'settings' }"
              :class="{
                'text-primary-500': router.currentRoute.value.name === 'settings',
                'flex items-center justify-center': !settingsStore.isNavigationExpanded,
                'flex items-center justify-start w-full': settingsStore.isNavigationExpanded,
              }"
            >
              <CogIcon class="w-6 h-6 hover:text-primary-500" />
              <span v-if="settingsStore.isNavigationExpanded" class="ml-3 text-sm"> Settings </span>
            </RouterLink>
          </SidebarItem>
        </div>
      </div>
    </aside>
    <div
      class="h-full flex transition-all duration-300"
      :class="{
        'pl-12': !settingsStore.isNavigationExpanded,
        'pl-48': settingsStore.isNavigationExpanded,
      }"
    >
      <main class="w-full h-full">
        <RouterView :key="$route.fullPath" />
      </main>
    </div>
    <Modal title="Add new project" ref="newProjectModal" size="xl">
      <NewProjectView @opened="newProjectModal.closeModal()" />
    </Modal>
  </div>
</template>
