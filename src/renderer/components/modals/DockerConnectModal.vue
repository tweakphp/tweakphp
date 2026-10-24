<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import DockerConnection from '../connections/DockerConnection.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import ArrowPathIcon from '../icons/ArrowPathIcon.vue'

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const form = ref<InstanceType<typeof DockerConnection> | null>(null)

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
    <DockerConnection ref="form" @connected="closeModal()" />
    <template #actions>
      <div class="flex justify-end gap-2">
        <PrimaryButton @click="form?.connect()" :disabled="form?.connecting">
          <ArrowPathIcon
            v-if="form?.connecting"
            :spin="true"
            class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
          />
          Connect
        </PrimaryButton>
      </div>
    </template>
  </Modal>
</template>
