<script setup lang="ts">
  import { RouterLink, RouterView } from 'vue-router'
  import { useColorSchemeStore } from './stores/color-scheme'
  import { ArchiveBoxIcon, CogIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
  import SidebarItem from './components/SidebarItem.vue'
  import TitleBar from './components/TitleBar.vue'
  import WorkspaceList from './components/WorkspaceList.vue'
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useTabsStore } from './stores/tabs'
  import { useHistoryStore } from './stores/history'
  import router from './router/index'
  import events from './events'
  import { useSettingsStore } from './stores/settings'
  import { useLspStore } from './stores/lsp'
  import { clampSidebarWidth, sidebarWidthBounds, useSidebarWidthStore } from './stores/sidebar-width'
  import { initServices } from 'monaco-languageclient/vscode/services'
  import getConfigurationServiceOverride, {
    initUserConfiguration,
  } from '@codingame/monaco-vscode-configuration-service-override'
  import { useUpdateStore } from './stores/update'
  import { UpdateInfo } from 'electron-updater'
  import ArchiveConfirmModal from './components/modals/ArchiveConfirmModal.vue'
  import NewProjectModal from './components/modals/NewProjectModal.vue'

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
  const sidebarWidthStore = useSidebarWidthStore()
  const updateStore = useUpdateStore()
  const lspStore = useLspStore()

  const lspStatusTooltip = computed(() => {
    switch (lspStore.status) {
      case 'connected':
        return 'Status LSP: Connected'
      case 'connecting':
        return 'Status LSP: Connecting...'
      case 'disconnected':
        return 'Status LSP: Disconnected (Click to reconnect)'
    }
  })

  const handleLspReconnect = () => {
    window.ipcRenderer.send('lsp.restart')
  }

  const tabInfo = computed(() => {
    const info = tabStore.current?.info
    if (!info || (!info.php_version && !info.version)) {
      return null
    }
    return info
  })

  const infoTooltip = computed(() => {
    if (!tabInfo.value) {
      return ''
    }
    const project = `${tabInfo.value.name} ${tabInfo.value.version}`.trim()
    let content = `PHP ${tabInfo.value.php_version}`
    if (project) {
      content += `<br>${project}`
    }
    return content
  })

  // Pages that are not tied to an open project: hide the LSP status and the
  // project info while visiting them.
  const isUtilityPage = computed(() => ['settings', 'archive'].includes(router.currentRoute.value.name as string))

  const newProjectModal = ref()

  const isSettingsReady = ref(false)
  const isEditorReady = ref(false)
  // Render views only when both settings and editor services are ready:
  // mounting editors triggers monaco API calls that would initialize the
  // standalone services before initServices() gets a chance to install
  // the vscode service overrides
  const isAppReady = computed(() => isSettingsReady.value && isEditorReady.value)
  const viewportWidth = ref(window.innerWidth)
  const isResizingSidebar = ref(false)
  const sidebarWidth = computed(() => clampSidebarWidth(sidebarWidthStore.width, viewportWidth.value))

  let resizePointerId: number | null = null
  let resizeHandle: HTMLElement | null = null
  let resizeStartWidth = 0
  let previousUserSelect = ''

  const startSidebarResize = (event: PointerEvent) => {
    if (event.button !== 0 || resizePointerId !== null) return

    event.preventDefault()
    resizePointerId = event.pointerId
    resizeHandle = event.currentTarget as HTMLElement
    resizeStartWidth = sidebarWidthStore.width
    previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    isResizingSidebar.value = true
    resizeHandle.setPointerCapture(event.pointerId)
  }

  const moveSidebarResize = (event: PointerEvent) => {
    if (event.pointerId !== resizePointerId) return
    sidebarWidthStore.setWidth(clampSidebarWidth(event.clientX, viewportWidth.value))
  }

  const stopSidebarResize = (persist: boolean) => {
    if (resizePointerId === null) return

    const pointerId = resizePointerId
    resizePointerId = null
    isResizingSidebar.value = false
    document.body.style.userSelect = previousUserSelect
    if (resizeHandle?.hasPointerCapture(pointerId)) resizeHandle.releasePointerCapture(pointerId)
    resizeHandle = null

    if (persist) {
      void sidebarWidthStore.persistWidth()
    } else {
      sidebarWidthStore.setWidth(resizeStartWidth)
    }
  }

  const endSidebarResize = (event: PointerEvent) => {
    if (event.pointerId !== resizePointerId) return
    moveSidebarResize(event)
    stopSidebarResize(true)
  }

  const cancelSidebarResize = (event: PointerEvent) => {
    if (event.pointerId === resizePointerId) stopSidebarResize(false)
  }

  const adjustSidebarWidth = (change: number) => {
    sidebarWidthStore.setWidth(clampSidebarWidth(sidebarWidth.value + change, viewportWidth.value))
    void sidebarWidthStore.persistWidth()
  }

  const updateViewportWidth = () => {
    viewportWidth.value = window.innerWidth
  }

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
    window.ipcRenderer.on('update.download-progress', (progress: any) => {
      updateStore.setDownloading(true)
      updateStore.setDownloadProgress(progress)
    })
    window.ipcRenderer.on('update.downloaded', () => {
      updateStore.setDownloading(false)
      updateStore.resetDownloadProgress()
    })
    window.ipcRenderer.on('update.cancelled', () => {
      updateStore.setDownloading(false)
      updateStore.resetDownloadProgress()
    })
    window.ipcRenderer.on('init.reply', async (e: any) => {
      settingsStore.setSettings(e.settings)
      await sidebarWidthStore.ready
      isSettingsReady.value = true
    })
    window.ipcRenderer.send('init')
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
    window.ipcRenderer.on('client.execute.stream', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.execute.stream', { detail: e }))
    })
    window.ipcRenderer.on('client.action.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.action.reply', { detail: e }))
    })
    window.ipcRenderer.on('client.info.reply', (e: any) => {
      events.dispatchEvent(new CustomEvent('client.info.reply', { detail: e }))
    })

    window.addEventListener('keydown', keydownListener)
    window.addEventListener('resize', updateViewportWidth)
    window.addEventListener('unhandledrejection', unhandledRejectionListener)

    try {
      await initEditor()
    } catch (error) {
      console.error('Failed to initialize editor services', error)
    } finally {
      isEditorReady.value = true
    }
  })

  onBeforeUnmount(() => {
    stopSidebarResize(false)
    window.removeEventListener('keydown', keydownListener)
    window.removeEventListener('resize', updateViewportWidth)
    window.removeEventListener('unhandledrejection', unhandledRejectionListener)
  })

  const initEditor = async () => {
    // Seed the vscode user configuration before services start.
    // The PHP language server pulls these settings via workspace/configuration:
    // triggerParameterHints makes function/method completions insert parentheses
    await initUserConfiguration(
      JSON.stringify({
        'intelephense.completion.triggerParameterHints': true,
      })
    )
    await initServices({
      serviceConfig: {
        debugLogging: true,
        userServices: {
          ...getConfigurationServiceOverride(),
        },
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
  <div
    v-if="isAppReady"
    class="h-full"
    :style="{ 'color': settingsStore.colors.foreground, '--sidebar-width': `${sidebarWidth}px` }"
  >
    <TitleBar />
    <aside
      class="fixed z-40 left-0 bottom-0 top-[38px] justify-between border-r"
      :class="{ 'transition-[width] duration-300': !isResizingSidebar }"
      :style="{
        width: 'var(--sidebar-width)',
        backgroundColor: settingsStore.colors.background,
        borderColor: settingsStore.colors.border,
      }"
    >
      <div class="relative h-full flex flex-col justify-between pb-10">
        <WorkspaceList @open-new-project="newProjectModal.openModal()" />
        <div class="absolute bottom-0 left-0 w-full border-t" :style="{ borderColor: settingsStore.colors.border }">
          <SidebarItem class="relative px-3 -mt-[1px]">
            <span
              v-if="
                updateStore.update &&
                updateStore.isUpdateAvailable(settingsStore.settings.version, updateStore.update.version)
              "
              class="absolute top-[12px] right-[12px] bg-primary-500 text-white size-2 rounded-full"
            >
            </span>
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-4">
                <RouterLink
                  :to="{ name: 'settings' }"
                  :class="{ 'text-primary-500': router.currentRoute.value.name === 'settings' }"
                >
                  <CogIcon class="size-5 hover:text-primary-500" />
                </RouterLink>
                <RouterLink
                  :to="{ name: 'archive' }"
                  :class="{ 'text-primary-500': router.currentRoute.value.name === 'archive' }"
                >
                  <ArchiveBoxIcon class="size-5 hover:text-primary-500" />
                </RouterLink>
              </div>
              <div v-if="!isUtilityPage" class="flex items-center justify-center gap-2">
                <div class="flex items-center cursor-pointer" v-tippy="lspStatusTooltip" @click="handleLspReconnect">
                  <div
                    class="rounded-full size-4"
                    :class="{
                      'bg-green-500': lspStore.status === 'connected',
                      'bg-yellow-500': lspStore.status === 'connecting',
                      'bg-red-500': lspStore.status === 'disconnected',
                    }"
                  ></div>
                </div>
                <InformationCircleIcon
                  v-if="tabInfo"
                  class="size-5 hover:text-primary-500"
                  v-tippy="{ content: infoTooltip, allowHTML: true, placement: 'top' }"
                />
              </div>
            </div>
          </SidebarItem>
        </div>
      </div>
      <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        :aria-valuenow="sidebarWidth"
        :aria-valuemin="sidebarWidthBounds(viewportWidth).min"
        :aria-valuemax="sidebarWidthBounds(viewportWidth).max"
        tabindex="0"
        class="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none"
        @pointerdown="startSidebarResize"
        @pointermove="moveSidebarResize"
        @pointerup="endSidebarResize"
        @pointercancel="cancelSidebarResize"
        @lostpointercapture="cancelSidebarResize"
        @keydown.left.prevent="adjustSidebarWidth(-16)"
        @keydown.right.prevent="adjustSidebarWidth(16)"
      >
        <span
          class="absolute inset-y-0 left-1/2 w-px bg-primary-500/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          :class="{ 'opacity-100': isResizingSidebar }"
        />
      </div>
    </aside>
    <div
      class="h-full flex"
      :class="{ 'transition-[padding] duration-300': !isResizingSidebar }"
      :style="{ paddingLeft: 'var(--sidebar-width)' }"
    >
      <main class="w-full h-full">
        <RouterView :key="$route.fullPath" />
      </main>
    </div>
    <NewProjectModal ref="newProjectModal" />
    <ArchiveConfirmModal />
  </div>
</template>
