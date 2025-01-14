<script setup lang="ts">
  import { ref } from 'vue'
  import PrimaryButton from './PrimaryButton.vue'
  import { useUpdateStore } from '../stores/update.ts'
  import { ArrowPathIcon } from '@heroicons/vue/24/outline'
  import { useSettingsStore } from '../stores/settings.ts'
  import Modal from './Modal.vue'
  import SecondaryButton from './SecondaryButton.vue'
  import { UpdateInfo } from 'electron-updater'

  const changelogModal = ref()
  const settingsStore = useSettingsStore()
  const updateStore = useUpdateStore()
  const updating = ref(false)

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
    window.ipcRenderer.send('update.download')
  }
</script>

<template>
  <div>
    <div
      class="flex items-center"
      v-if="
        updateStore.update && updateStore.isUpdateAvailable(settingsStore.settings.version, updateStore.update.version)
      "
    >
      <button
        type="button"
        class="mr-2 text-sm underline"
        v-tippy="`Version ${updateStore.update.version} changelog`"
        @click="openChangelogModal"
      >
        Changelog
      </button>
      <PrimaryButton v-tippy="`Update to ${updateStore.update.version}`" @click="update" :disabled="updating">
        <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': updating }" />
      </PrimaryButton>
    </div>
    <div v-else class="mr-2 text-sm">
      <span v-if="updateStore.checking">Checking...</span>
      <button v-else type="button" class="underline" @click="checkForUpdates">Check for updates</button>
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
