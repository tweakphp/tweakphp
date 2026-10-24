<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import TextInput from '../TextInput.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'

  const props = withDefaults(
    defineProps<{
      title: string
      label: string
      id?: string
      placeholder?: string
      confirmText?: string
      cancelText?: string
      initialValue?: string
      size?: string
    }>(),
    {
      id: 'prompt-input',
      placeholder: '',
      confirmText: 'Save',
      cancelText: 'Cancel',
      initialValue: '',
      size: 'md',
    }
  )

  const emit = defineEmits<{
    (e: 'confirm', value: string): void
    (e: 'cancel'): void
  }>()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const value = ref(props.initialValue)

  const openModal = () => {
    value.value = props.initialValue
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  const cancel = () => {
    closeModal()
    emit('cancel')
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
  <Modal :title="props.title" ref="modal" :size="props.size">
    <div>
      <label :for="props.id" class="block text-sm font-medium text-gray-300 mb-2">{{ props.label }}</label>
      <TextInput
        class="w-full"
        :id="props.id"
        v-model="value"
        @keyup.enter="confirm"
        :placeholder="props.placeholder"
      />
    </div>
    <div class="mt-6 flex justify-end space-x-3">
      <SecondaryButton @click="cancel">{{ props.cancelText }}</SecondaryButton>
      <PrimaryButton @click="confirm">{{ props.confirmText }}</PrimaryButton>
    </div>
  </Modal>
</template>
