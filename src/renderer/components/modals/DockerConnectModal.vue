<script setup lang="ts">
  import { ref } from 'vue'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import DockerConnection from '../connections/DockerConnection.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import ArrowPathIcon from '../icons/ArrowPathIcon.vue'
  import { useTabsStore } from '../../stores/tabs'
  import { ConnectionConfig } from '../../../types/docker.type'

  const tabsStore = useTabsStore()

  const emit = defineEmits<{
    (e: 'connected', connection: ConnectionConfig): void
  }>()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const form = ref<InstanceType<typeof DockerConnection> | null>(null)

  const openModal = () => {
    modal.value?.openModal()
  }

  const closeModal = () => {
    modal.value?.closeModal()
  }

  // Toolbar usage: the docker config is stored on the current project tab
  const onConnected = (connection: ConnectionConfig) => {
    const tab = tabsStore.getCurrent()
    if (tab) {
      tab.docker = connection
      tab.execution = 'docker'
      tabsStore.updateTab(tab)
    }
    emit('connected', connection)
    closeModal()
  }

  defineExpose({ openModal, closeModal })
</script>

<template>
  <Modal ref="modal" title="Connect to Docker" :size="ModalSize.XL">
    <DockerConnection ref="form" @connected="onConnected" />
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
