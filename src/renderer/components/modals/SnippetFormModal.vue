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

  const props = defineProps<{
    snippet?: Snippet | null
  }>()

  const emit = defineEmits<{
    (e: 'saved', snippet: Snippet): void
  }>()

  const settingsStore = useSettingsStore()
  const snippetsStore = useSnippetsStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const formTitle = ref('')
  const formCode = ref('')
  const formEditorId = ref('')

  const modalTitle = computed(() => (props.snippet?.id ? 'Edit Snippet' : 'New Snippet'))
  const canSave = computed(() => formCode.value.trim().length > 0)

  const openModal = () => {
    formTitle.value = props.snippet?.title ?? ''
    formCode.value = props.snippet?.code ?? ''
    formEditorId.value = `snippet-form-${props.snippet?.id ?? 'new'}-${Date.now()}`
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  const saveSnippetForm = async () => {
    if (!canSave.value) {
      return
    }
    const payload: Snippet = { title: formTitle.value, code: formCode.value }
    if (props.snippet?.id) {
      payload.id = props.snippet.id
    }
    const saved = await snippetsStore.add(payload)
    closeModal()
    emit('saved', saved)
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal :title="modalTitle" ref="modal" :size="ModalSize.THREE_XL">
    <div class="space-y-3">
      <TextInput v-model="formTitle" placeholder="Title (optional)" class="w-full" />
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
      />
    </div>
    <template #actions>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="closeModal">Cancel</SecondaryButton>
        <PrimaryButton :disabled="!canSave" @click="saveSnippetForm">Save Snippet</PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
