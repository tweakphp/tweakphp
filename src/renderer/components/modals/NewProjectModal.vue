<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import NewProjectView from '../NewProjectView.vue'

  const modal = ref<InstanceType<typeof Modal> | null>(null)

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" title="Add new project" size="xl">
    <NewProjectView @opened="closeModal()" />
  </Modal>
</template>
