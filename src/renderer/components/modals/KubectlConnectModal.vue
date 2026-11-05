<script setup lang="ts">
  import { computed, ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import KubectlConnectForm from '../forms/KubectlConnectForm.vue'
  import PrimaryButton from '../PrimaryButton.vue'

  const props = withDefaults(
    defineProps<{
      id?: number
      title?: string
    }>(),
    {
      id: undefined,
      title: '',
    }
  )

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const form = ref<InstanceType<typeof KubectlConnectForm> | null>(null)

  const modalTitle = computed(() => props.title || (props.id ? 'Edit Connection' : 'Add Connection'))

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" :title="modalTitle" :size="ModalSize.LG">
    <KubectlConnectForm ref="form" :id="props.id" @done="closeModal()" />
    <template #actions>
      <div class="flex justify-end gap-2">
        <PrimaryButton @click="form?.save()"> Save </PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
