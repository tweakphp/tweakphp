<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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
  const saving = ref(false)
  const saveError = ref('')
  const pendingRequests: string[] = []

  const snippetSaveRequestListener = (event: Event) => {
    const code = (event as CustomEvent<{ code: string }>).detail.code
    if (saving.value || modal.value?.isModalOpen || pendingRequests.length) {
      pendingRequests.push(code)
      if (!saving.value && !modal.value?.isModalOpen) showNextRequest()
      return
    }
    showRequest(code)
  }

  const showRequest = (code: string) => {
    snippetCode.value = code
    snippetTitle.value = ''
    saveError.value = ''
    modal.value?.openModal()
  }

  const showNextRequest = () => {
    const next = pendingRequests.shift()
    if (next !== undefined) showRequest(next)
  }

  const cancel = () => {
    modal.value?.closeModal()
    onClosed()
  }

  const onClosed = () => {
    void nextTick(() => {
      if (!saving.value && !modal.value?.isModalOpen) showNextRequest()
    })
  }

  const saveSnippet = async () => {
    if (!snippetCode.value.trim() || saving.value) {
      return
    }
    saving.value = true
    saveError.value = ''
    try {
      await snippetsStore.add({ title: snippetTitle.value, code: snippetCode.value })
      if (pendingRequests.length) showNextRequest()
      else modal.value?.closeModal()
    } catch {
      saveError.value = 'Could not save the snippet. Please try again.'
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    events.addEventListener('snippet.save.request', snippetSaveRequestListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('snippet.save.request', snippetSaveRequestListener)
  })
</script>

<template>
  <Modal
    title="Save Snippet"
    ref="modal"
    :size="ModalSize.TWO_XL"
    :show-close-button="!saving"
    :close-on-esc="!saving"
    :close-on-outside-click="!saving"
    @closed="onClosed"
  >
    <div class="space-y-3">
      <TextInput
        v-model="snippetTitle"
        placeholder="Title (optional)"
        aria-label="Snippet title"
        :disabled="saving"
        autofocus
        class="w-full"
      />
      <pre
        class="p-3 rounded-md border font-mono text-xs overflow-auto max-h-[40vh] whitespace-pre-wrap break-all"
        :style="{
          backgroundColor: settingsStore.colors.backgroundLight,
          borderColor: settingsStore.colors.border,
          color: settingsStore.colors.foreground,
        }"
        >{{ snippetCode }}</pre>
      <p v-if="saveError" role="alert" class="text-sm text-red-500">{{ saveError }}</p>
    </div>
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton :disabled="saving" @click="cancel">Cancel</SecondaryButton>
        <PrimaryButton :disabled="saving || !snippetCode.trim()" @click="saveSnippet">{{
          saving ? 'Saving…' : 'Save Snippet'
        }}</PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
