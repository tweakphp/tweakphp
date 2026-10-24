<script setup lang="ts">
  import { ref } from 'vue'
  import PromptModal from './PromptModal.vue'
  import { useFoldersStore } from '../../stores/folders'
  import { WorkspaceFolder } from '../../../types/workspace-folder.type'

  const foldersStore = useFoldersStore()

  const emit = defineEmits<{
    (e: 'created', folder: WorkspaceFolder): void
  }>()

  const promptModal = ref<InstanceType<typeof PromptModal> | null>(null)

  const openModal = () => {
    promptModal.value?.openModal()
  }

  const closeModal = () => {
    promptModal.value?.closeModal()
  }

  const createFolder = async (name: string) => {
    const folder = await foldersStore.createFolder(name)
    emit('created', folder)
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <PromptModal
    ref="promptModal"
    title="New folder"
    label="Folder Name"
    id="newFolderName"
    placeholder="Enter a folder name"
    confirm-text="Create"
    @confirm="createFolder"
  />
</template>
