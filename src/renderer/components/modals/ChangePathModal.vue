<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import TextInput from '../TextInput.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import { FolderOpenIcon } from '@heroicons/vue/24/outline'
  import { Tab } from '../../../types/tab.type'

  const props = defineProps<{
    tab: Tab
  }>()

  const emit = defineEmits<{
    (e: 'confirm', value: string): void
  }>()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const value = ref(props.tab.path ?? '')

  const openModal = () => {
    value.value = props.tab.path ?? ''
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  const browse = async () => {
    const path = (await window.ipcRenderer.invoke('source.pickDirectory')) as string | null
    if (path) {
      value.value = path
    }
  }

  const confirm = () => {
    const trimmed = value.value.trim()
    if (!trimmed) {
      return
    }
    closeModal()
    emit('confirm', trimmed)
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" title="Change path" :size="ModalSize.LG">
    <div>
      <label for="tabPath" class="block text-sm font-medium text-gray-300 mb-2">Project Path</label>
      <div class="flex items-center gap-2">
        <TextInput
          class="w-full"
          id="tabPath"
          v-model="value"
          @keyup.enter="confirm"
          placeholder="Enter or browse the project folder"
        />
        <SecondaryButton @click="browse">
          <FolderOpenIcon class="size-4" />
          <span>Browse…</span>
        </SecondaryButton>
      </div>
    </div>
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="closeModal">Cancel</SecondaryButton>
        <PrimaryButton @click="confirm">Save</PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
