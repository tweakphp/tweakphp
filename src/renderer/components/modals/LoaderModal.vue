<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import Loader from '../Loader.vue'

  const props = withDefaults(
    defineProps<{
      edit?: string
    }>(),
    {
      edit: '',
    }
  )

  const modal = ref<InstanceType<typeof Modal> | null>(null)

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  // when editing, the loader form stays open to allow further tweaks
  const onSaved = () => {
    if (!props.edit) {
      closeModal()
    }
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" :title="props.edit ? 'Edit Loader' : 'Add Loader'" size="4xl">
    <Loader :edit="props.edit" @saved="onSaved" />
  </Modal>
</template>
