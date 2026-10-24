<script setup lang="ts">
  import { computed, ref } from 'vue'
  import Modal from '../Modal.vue'
  import KubectlConnectForm from '../forms/KubectlConnectForm.vue'

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
  <Modal ref="modal" :title="modalTitle" size="lg">
    <KubectlConnectForm :id="props.id" @done="closeModal()" />
  </Modal>
</template>
