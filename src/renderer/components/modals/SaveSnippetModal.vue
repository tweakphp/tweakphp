<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import TextInput from '../TextInput.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import events from '../../events'
  import { useSettingsStore } from '../../stores/settings'
  import { useSnippetsStore } from '../../stores/snippets'

  const settingsStore = useSettingsStore()
  const snippetsStore = useSnippetsStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const snippetTitle = ref('')
  const snippetCode = ref('')

  const snippetSaveRequestListener = (event: Event) => {
    snippetCode.value = (event as CustomEvent<{ code: string }>).detail.code
    snippetTitle.value = ''
    modal.value?.openModal()
  }

  const saveSnippet = async () => {
    if (!snippetCode.value.trim()) {
      return
    }
    await snippetsStore.add({ title: snippetTitle.value, code: snippetCode.value })
    modal.value?.closeModal()
  }

  onMounted(() => {
    events.addEventListener('snippet.save.request', snippetSaveRequestListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('snippet.save.request', snippetSaveRequestListener)
  })
</script>

<template>
  <Modal title="Save Snippet" ref="modal" :size="ModalSize.TWO_XL">
    <div class="space-y-3">
      <TextInput v-model="snippetTitle" placeholder="Title (optional)" class="w-full" />
      <pre
        class="p-3 rounded-md border font-mono text-xs overflow-auto max-h-[40vh] whitespace-pre-wrap break-all"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          borderColor: settingsStore.colors.border,
          color: settingsStore.colors.foreground,
        }"
        >{{ snippetCode }}</pre>
    </div>
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="modal?.closeModal()">Cancel</SecondaryButton>
        <PrimaryButton @click="saveSnippet">Save Snippet</PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
