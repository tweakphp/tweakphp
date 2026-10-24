<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import SSHConnections from '../connections/SSHConnections.vue'

  const emit = defineEmits<{
    (e: 'connected', connection: { id: number }): void
    (e: 'removed', id: number): void
  }>()

  const modal = ref<InstanceType<typeof Modal> | null>(null)

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  const onConnected = (connection: { id: number }) => {
    closeModal()
    emit('connected', connection)
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" title="Connect to SSH" size="2xl">
    <SSHConnections @connected="onConnected" @removed="id => emit('removed', id)" />
  </Modal>
</template>
