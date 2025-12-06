<script setup lang="ts">
  import { ref } from 'vue'
  import PrimaryButton from './PrimaryButton.vue'
  import { useUpdateStore } from '../stores/update.ts'
  import { ArrowPathIcon, XMarkIcon } from '@heroicons/vue/24/outline'
  import { useSettingsStore } from '../stores/settings.ts'
  import Modal from './Modal.vue'
  import SecondaryButton from './SecondaryButton.vue'
  import { UpdateInfo } from 'electron-updater'

  const changelogModal = ref()
  const settingsStore = useSettingsStore()
  const updateStore = useUpdateStore()
  const updating = ref(false)
  const isDev = window.platformInfo.isDev()

  const checkForUpdates = () => {
    updateStore.setChecking(true)
    window.ipcRenderer.send('update.check')
  }

  const openChangelogModal = () => {
    changelogModal.value.openModal()
  }

  const openInBrowser = (update?: UpdateInfo) => {
    if (update) {
      window.ipcRenderer.send('link.open', `https://github.com/tweakphp/tweakphp/releases/tag/v${update.releaseName}`)
    }
  }

  const update = () => {
    updating.value = true
    updateStore.resetDownloadProgress()
    window.ipcRenderer.send('update.download')
  }

  const testProgress = () => {
    updating.value = true
    updateStore.resetDownloadProgress()
    window.ipcRenderer.send('update.test-progress')
  }

  const cancelUpdate = () => {
    updating.value = false
    updateStore.setDownloading(false)
    updateStore.resetDownloadProgress()
    window.ipcRenderer.send('update.cancel')
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }
</script>

<template>
  <div class="w-full flex items-center justify-end">
    <!-- Progress bar - shown when downloading -->
    <div v-if="updateStore.downloading" class="flex flex-col gap-1 w-full">
      <div class="flex items-center gap-2 w-full">
        <div class="flex-1 min-w-0 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-primary-500 transition-all duration-300 ease-out"
            :style="{ width: `${updateStore.downloadProgress.percent}%` }"
          ></div>
        </div>
        <button
          @click="cancelUpdate"
          class="p-1 opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
          v-tippy="'Cancel update'"
          :style="{ color: settingsStore.colors.foreground }"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
      <div class="text-xs opacity-70 whitespace-nowrap overflow-hidden text-ellipsis">
        {{ Math.round(updateStore.downloadProgress.percent) }}% -
        {{ formatBytes(updateStore.downloadProgress.transferred) }} /
        {{ formatBytes(updateStore.downloadProgress.total) }}
        ({{ formatBytes(updateStore.downloadProgress.bytesPerSecond) }}/s)
      </div>
    </div>

    <!-- Update available section -->
    <div
      v-else-if="
        updateStore.update && updateStore.isUpdateAvailable(settingsStore.settings.version, updateStore.update.version)
      "
    >
      <div class="flex items-center">
        <button
          type="button"
          class="mr-2 text-sm underline"
          v-tippy="`Version ${updateStore.update.version} changelog`"
          @click="openChangelogModal"
        >
          Changelog
        </button>
        <PrimaryButton v-tippy="`Update to ${updateStore.update.version}`" @click="update" :disabled="updating">
          <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': updating && !updateStore.downloading }" />
        </PrimaryButton>
      </div>
    </div>

    <!-- No update available section -->
    <div v-else class="mr-2 text-sm">
      <span v-if="updateStore.checking">Checking...</span>
      <div v-else class="flex items-center gap-2">
        <button type="button" class="underline" @click="checkForUpdates">Check for updates</button>
        <button v-if="isDev" type="button" class="text-xs opacity-60 underline" @click="testProgress">
          Test Progress
        </button>
      </div>
    </div>
    <Modal :title="`Version ${updateStore.update?.version} Changelog`" ref="changelogModal">
      <div class="prose max-w-none" v-html="updateStore.update?.releaseNotes"></div>
      <SecondaryButton class="mt-5" @click="openInBrowser(updateStore.update)" :autofocus="false"
        >Open in Browser</SecondaryButton
      >
    </Modal>
  </div>
</template>

<style scoped></style>
