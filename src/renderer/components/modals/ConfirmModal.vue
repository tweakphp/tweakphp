<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'

  const props = withDefaults(
    defineProps<{
      title: string
      confirmText?: string
      cancelText?: string
      size?: string
    }>(),
    {
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      size: 'md',
    }
  )

  const emit = defineEmits<{
    (e: 'confirm'): void
    (e: 'cancel'): void
  }>()

  const modal = ref<InstanceType<typeof Modal> | null>(null)

  const openModal = () => {
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
    closeModal()
    emit('confirm')
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal :title="props.title" ref="modal" :size="props.size">
    <div class="space-y-5">
      <div class="text-sm">
        <slot />
      </div>
      <div class="flex justify-end gap-2">
        <SecondaryButton @click="cancel">{{ props.cancelText }}</SecondaryButton>
        <PrimaryButton @click="confirm">{{ props.confirmText }}</PrimaryButton>
      </div>
    </div>
  </Modal>
</template>
