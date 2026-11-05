<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'

  const props = withDefaults(
    defineProps<{
      title: string
      confirmText?: string
      cancelText?: string
      size?: ModalSize
    }>(),
    {
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      size: ModalSize.MD,
    }
  )

  const emit = defineEmits<{
    (e: 'confirm'): void
    (e: 'cancel'): void
    // Reka-initiated closes only (X, Esc, outside click). The programmatic
    // closeModal does not route through here: handlers that need to reset
    // their state on every close path should do it in their own actions.
    (e: 'closed'): void
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

  const onClosed = () => {
    emit('closed')
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal :title="props.title" ref="modal" :size="props.size" @closed="onClosed">
    <div class="text-sm">
      <slot />
    </div>
    <template #actions>
      <!-- Custom actions (extra buttons, different labels/styling); falls
           back to the standard Cancel/Confirm row -->
      <slot name="actions">
        <div class="flex justify-end gap-2">
          <SecondaryButton @click="cancel">{{ props.cancelText }}</SecondaryButton>
          <PrimaryButton @click="confirm">{{ props.confirmText }}</PrimaryButton>
        </div>
      </slot>
    </template>
  </Modal>
</template>
