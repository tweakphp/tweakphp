<script setup lang="ts">
  import { ref } from 'vue'
  import PromptModal from './PromptModal.vue'
  import { useFoldersStore } from '../../stores/folders'
  import { WorkspaceFolder } from '../../../types/workspace-folder.type'

  const foldersStore = useFoldersStore()

  const props = defineProps<{
    folder: WorkspaceFolder
  }>()

  const promptModal = ref<InstanceType<typeof PromptModal> | null>(null)

  const openModal = () => {
    promptModal.value?.openModal()
  }

  const saveFolderName = (name: string) => {
    foldersStore.renameFolder(props.folder.id, name)
  }

  defineExpose({ openModal })
</script>

<template>
  <PromptModal
    ref="promptModal"
    title="Rename folder"
    label="Folder Name"
    id="folderName"
    :initial-value="props.folder.name"
    placeholder="Enter a new name"
    confirm-text="Save"
    @confirm="saveFolderName"
  />
</template>
