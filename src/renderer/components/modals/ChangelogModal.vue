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
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="openInBrowser(updateStore.update)">Open in Browser</SecondaryButton>
      </div>
    </template>
  </Modal>
</template>
