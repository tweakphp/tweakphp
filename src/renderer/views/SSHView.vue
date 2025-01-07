<script setup lang="ts">
  import PrimaryButton from '../components/PrimaryButton.vue'
  import { EyeIcon, PlusIcon, TrashIcon, WifiIcon, ArrowPathIcon, PencilIcon } from '@heroicons/vue/24/outline'
  import { onBeforeUnmount, onMounted, ref, defineEmits } from 'vue'
  import { useSSHStore } from '../stores/ssh'
  import Divider from '../components/Divider.vue'
  import Modal from '../components/Modal.vue'
  import SSHConnectView from './SSHConnectView.vue'
  import events from '../events'
  import { ConnectionConfig } from '../../types/ssh.type'

  const sshStore = useSSHStore()
  const sshConnectModal = ref()
  const connecting = ref()
  const editId = ref()
  const emit = defineEmits(['connected', 'removed'])

  onMounted(() => {
    events.addEventListener('ssh.connect.reply', connectReply)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('ssh.connect.reply', connectReply)
  })

  const connect = (connection: ConnectionConfig) => {
    connecting.value = connection.id
    window.ipcRenderer.send('ssh.connect', { ...connection }, { state: 'connect' })
  }

  const add = () => {
    editId.value = null
    sshConnectModal.value.openModal()
  }

  const edit = (id: number) => {
    editId.value = id
    sshConnectModal.value.openModal()
  }

  const connectReply = (e: any) => {
    if (e.detail.data.state === 'connect') {
      connecting.value = null
      if (e.detail.connected) {
        emit('connected', e.detail.config)
      }
    }
  }

  const remove = (id: number) => {
    sshStore.remove(id)
    emit('removed', id)
  }
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <div class="mx-auto space-y-3">
      <div class="space-y-3">
        <div class="grid grid-cols-5 gap-2 items-center">
          <div>Name</div>
          <div>Host</div>
          <div>Port</div>
          <div>Path</div>
          <div class="flex justify-end">
            <PrimaryButton @click="add">
              <PlusIcon class="w-4 h-4" />
            </PrimaryButton>
          </div>
        </div>
        <Divider />
        <template v-for="connection in sshStore.connections">
          <div class="grid grid-cols-5 gap-2 items-center">
            <div class="flex items-center">
              <div class="size-4 rounded-full mr-1" :class="[`bg-${connection.color}-500`]"></div>
              {{ connection.name }}
            </div>
            <div>{{ connection.host }}</div>
            <div>{{ connection.port }}</div>
            <div>
              <EyeIcon v-tippy="connection.path" class="size-4 hover:text-blue-500" />
            </div>
            <div class="flex justify-end space-x-2">
              <PencilIcon
                v-tippy="'Edit'"
                class="size-4 hover:text-blue-500 cursor-pointer"
                @click="edit(connection.id)"
              />
              <TrashIcon
                v-tippy="'Delete'"
                class="size-4 hover:text-red-500 cursor-pointer"
                @click="remove(connection.id)"
              />
              <ArrowPathIcon v-if="connecting === connection.id" class="size-4 text-green-500 animate-spin" />
              <WifiIcon
                v-else
                @click="connect(connection)"
                v-tippy="'Connect'"
                class="size-4 ml-2 hover:text-green-500 cursor-pointer"
              />
            </div>
          </div>
          <Divider />
        </template>
      </div>
      <div v-if="Object.values(sshStore.connections).length === 0" class="grid grid-cols-1 items-center">
        <div>No connections yet!</div>
      </div>
    </div>
    <Modal ref="sshConnectModal" :title="editId ? 'Edit Connection' : 'Add Connection'" size="lg">
      <SSHConnectView @connected="sshConnectModal.closeModal()" :id="editId" />
    </Modal>
  </div>
</template>

<style scoped></style>
