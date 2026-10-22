<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '@/components/Modal.vue'
  import TextInput from '@/components/TextInput.vue'
  import PrimaryButton from '@/components/PrimaryButton.vue'
  import SecondaryButton from '@/components/SecondaryButton.vue'
  import { useFoldersStore } from '../stores/folders'
  import { WorkspaceFolder } from '../../types/workspace-folder.type'

  const foldersStore = useFoldersStore()

  const emit = defineEmits<{
    (e: 'created', folder: WorkspaceFolder): void
  }>()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const folderName = ref('')

  const openModal = () => {
    folderName.value = ''
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  const createFolder = async () => {
    const name = folderName.value.trim()
    if (!name) {
      return
    }
    const folder = await foldersStore.createFolder(name)
    closeModal()
    folderName.value = ''
    emit('created', folder)
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal title="New folder" ref="modal" size="md">
    <div>
      <label for="newFolderName" class="block text-sm font-medium text-gray-300 mb-2">Folder Name</label>
      <TextInput
        class="w-full"
        id="newFolderName"
        v-model="folderName"
        @keyup.enter="createFolder"
        placeholder="Enter a folder name"
      />
    </div>
    <div class="mt-6 flex justify-end space-x-3">
      <SecondaryButton @click="closeModal">Cancel</SecondaryButton>
      <PrimaryButton @click="createFolder">Create</PrimaryButton>
    </div>
  </Modal>
</template>
