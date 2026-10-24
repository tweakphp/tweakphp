<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import { useUpdateStore } from '../../stores/update'
  import { UpdateInfo } from 'electron-updater'

  const updateStore = useUpdateStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)

  const openModal = () => {
    modal.value?.openModal()
  }

  const openInBrowser = (update?: UpdateInfo) => {
    if (update) {
      window.ipcRenderer.send('link.open', `https://github.com/tweakphp/tweakphp/releases/tag/v${update.releaseName}`)
    }
  }

  defineExpose({ openModal })
</script>

<template>
  <Modal :title="`Version ${updateStore.update?.version} Changelog`" ref="modal">
    <div class="prose max-w-none" v-html="updateStore.update?.releaseNotes"></div>
    <SecondaryButton class="mt-5" @click="openInBrowser(updateStore.update)" :autofocus="false"
      >Open in Browser</SecondaryButton
    >
  </Modal>
</template>
