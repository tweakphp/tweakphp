<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import QueriesView from '../QueriesView.vue'

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
  <Modal ref="modal" title="Executed Queries" size="4xl">
    <QueriesView />
  </Modal>
</template>
