<script setup lang="ts">
  import { computed, ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import TextInput from '../TextInput.vue'
  import Editor from '../Editor.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import { useSettingsStore } from '../../stores/settings'
  import { useSnippetsStore } from '../../stores/snippets'
  import { Snippet } from '../../../types/snippet.type'
  import ConfirmModal from './ConfirmModal.vue'

  const emit = defineEmits<{
    (e: 'saved', snippet: Snippet): void
  }>()

  const settingsStore = useSettingsStore()
  const snippetsStore = useSnippetsStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const editingSnippet = ref<Snippet | null>(null)
  const formTitle = ref('')
  const formCode = ref('')
  const formEditorId = ref('')
  const discardModal = ref<InstanceType<typeof ConfirmModal> | null>(null)
  const saving = ref(false)
  const saveError = ref('')
  const initialTitle = ref('')
  const initialCode = ref('')

  const modalTitle = computed(() => (editingSnippet.value?.id ? 'Edit Snippet' : 'New Snippet'))
  const canSave = computed(() => formCode.value.trim().length > 0)
  const isDirty = computed(() => formTitle.value !== initialTitle.value || formCode.value !== initialCode.value)

  // the snippet is passed as an argument on purpose: reading it from the props
  // here would return a stale value, since the parent ref updates on next tick
  const openModal = (snippet?: Snippet | null) => {
    editingSnippet.value = snippet ?? null
    formTitle.value = snippet?.title ?? ''
    formCode.value = snippet?.code ?? ''
    initialTitle.value = formTitle.value
    initialCode.value = formCode.value
    saveError.value = ''
    formEditorId.value = `snippet-form-${snippet?.id ?? 'new'}-${Date.now()}`
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  const requestClose = () => {
    if (saving.value) return
    if (isDirty.value) discardModal.value?.openModal()
    else closeModal()
  }

  const onDismiss = (event: Event) => {
    event.preventDefault()
    requestClose()
  }

  const saveSnippetForm = async () => {
    if (!canSave.value || saving.value) {
      return
    }
    const payload: Snippet = { title: formTitle.value, code: formCode.value }
    if (editingSnippet.value?.id) {
      payload.id = editingSnippet.value.id
    }
    saving.value = true
    saveError.value = ''
    try {
      const saved = await snippetsStore.add(payload)
      closeModal()
      emit('saved', saved)
    } catch {
      saveError.value = 'Could not save the snippet. Please try again.'
    } finally {
      saving.value = false
    }
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal
    :title="modalTitle"
    ref="modal"
    :size="ModalSize.THREE_XL"
    :show-close-button="false"
    @escape-key-down="onDismiss"
    @pointer-down-outside="onDismiss"
  >
    <div class="space-y-3">
      <TextInput
        v-model="formTitle"
        placeholder="Title (optional)"
        aria-label="Snippet title"
        :disabled="saving"
        autofocus
        class="w-full"
      />
      <Editor
        :key="formEditorId"
        v-model:value="formCode"
        :editor-id="formEditorId"
        class="w-full border rounded-md p-1"
        :style="{
          borderColor: settingsStore.colors.border,
          height: '400px',
        }"
        language="php"
        :readonly="saving"
      />
      <p v-if="saveError" role="alert" class="text-sm text-red-500">{{ saveError }}</p>
    </div>
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton :disabled="saving" @click="requestClose">Cancel</SecondaryButton>
        <PrimaryButton :disabled="!canSave || saving" @click="saveSnippetForm">{{
          saving ? 'Saving…' : 'Save Snippet'
        }}</PrimaryButton>
      </div>
    </template>
    <ConfirmModal ref="discardModal" title="Discard changes?" confirm-text="Discard" @confirm="closeModal">
      Your changes to this snippet will be lost.
    </ConfirmModal>
  </Modal>
</template>
