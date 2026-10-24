<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import DockerConnection from '../connections/DockerConnection.vue'

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
  <Modal ref="modal" title="Connect to Docker" size="xl">
    <DockerConnection @connected="closeModal()" />
  </Modal>
</template>
