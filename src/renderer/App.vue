<script setup lang="ts">
  import { RouterLink, RouterView } from 'vue-router'
  import { useColorSchemeStore } from './stores/color-scheme'
  import { useExecuteStore } from './stores/execute'
  import { ArrowPathIcon, BoltIcon, CogIcon, FolderOpenIcon, WifiIcon } from '@heroicons/vue/24/outline'
  import SidebarItem from './components/SidebarItem.vue'
  import TitleBar from './components/TitleBar.vue'
  import { onMounted, ref } from 'vue'
  import { useTabsStore } from './stores/tabs'
  import { useHistoryStore } from './stores/history'
  import router from './router/index'
  import events from './events'
  import { useSettingsStore } from './stores/settings'
  import { initServices } from 'monaco-languageclient/vscode/services'
  import { useUpdateStore } from './stores/update'
  import { UpdateInfo } from 'electron-updater'
  import DockerIcon from './components/icons/DockerIcon.vue'

  const colorSchemeStore = useColorSchemeStore()
  const colorSchemeSetup = () => {
    if (colorSchemeStore.isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const executeStore = useExecuteStore()
  const tabStore = useTabsStore()
  const historyStore = useHistoryStore()
  const settingsStore = useSettingsStore()
  const updateStore = useUpdateStore()

  const platform = window.platformInfo.getPlatform()

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
      settingsStore.settings = e.settings
      isAppReady.value = true
    })
    window.ipcRenderer.on('source.open.reply', (e: any) => {
      router.push({ name: 'home' })
      tabStore.addTab({
        path: e,
        type: 'code',
      })
      historyStore.addHistory({ path: e })
    })
    window.ipcRenderer.on('client.execute.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.execute.reply', { detail: e }))
    })
    window.ipcRenderer.on('client.info.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.info.reply', { detail: e }))
    })
    window.ipcRenderer.on('ssh.connect.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('ssh.connect.reply', { detail: e }))
    })
    await initEditor()
  })

  const openFolder = () => {
    window.ipcRenderer.send('source.open')
  }

  const initEditor = async () => {
    await initServices({
      serviceConfig: {
        debugLogging: true,
      },
    })
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
      <div class="h-full flex flex-col justify-between">
        <div>
          <SidebarItem :active="router.currentRoute.value.name === 'code'">
            <RouterLink :to="router.currentRoute.value.name === 'code' ? '' : '/'">
              <ArrowPathIcon class="w-6 h-6 animate-spin" v-if="executeStore.executing" :spin="true" />
              <BoltIcon v-else class="w-6 h-6 hover:text-primary-500" />
            </RouterLink>
          </SidebarItem>
          <SidebarItem>
            <RouterLink to="">
              <FolderOpenIcon @click="openFolder" class="w-6 h-6 hover:text-primary-500" />
            </RouterLink>
          </SidebarItem>
          <SidebarItem
            :disabled="tabStore.current?.type === 'home'"
            :active="router.currentRoute.value.path.includes('/docker')"
          >
            <RouterLink v-if="tabStore.current?.type !== 'home'" to="/docker">
              <DockerIcon class="w-6 h-6 fill-transparent hover:text-primary-500" />
            </RouterLink>
            <span
              v-else
              class="w-6 h-6 opacity-70 cursor-not-allowed"
              v-tippy="{ content: 'Open a project first!', placement: 'right' }"
            >
              <DockerIcon class="fill-transparent" />
            </span>
          </SidebarItem>
          <SidebarItem :active="router.currentRoute.value.path.includes('/ssh')">
            <RouterLink to="/ssh">
              <WifiIcon class="w-6 h-6 hover:text-primary-500" />
            </RouterLink>
          </SidebarItem>
        </div>
        <div class="border-t" :style="{ borderColor: settingsStore.colors.border }">
          <SidebarItem :active="router.currentRoute.value.path === '/settings'" class="relative">
            <span
              v-if="
                updateStore.update &&
                updateStore.isUpdateAvailable(settingsStore.settings.version, updateStore.update.version)
              "
              class="absolute top-[5px] right-[5px] bg-primary-500 text-white w-[7px] h-[7px] rounded-full"
            >
            </span>
            <RouterLink to="/settings">
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
  </div>
</template>
